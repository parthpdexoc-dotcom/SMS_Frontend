import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SMSTextField, SMSDropdown, SMSBox, SMSStack, SMSTypography, SMSButton, SMSCheckbox, SMSMultiSelectDropdown } from '@/components/smsatoms';
import { SMSDataDisplay as DataDisplay } from '@/components/smsmolecules/SMSDataDisplay';
import { FormViewSection } from '@/components/smsmolecules/FormViewSection/FormViewSection';
import { REQUESTER, POST } from '@/constants/strings';
import { CreateRequesterRequest, RequesterResponse, UpdateRequesterRequest } from '@/types/requester';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertRequesterThunk, fetchRequesters, fetchRequesterOptionsThunk } from '@/store/slices/requesterSlice';
import { addToast } from '@/store/slices/toastSlice';
import { fetchBusinessTypeOptions } from '@/store/slices/businessTypeSlice';
import { fetchSkillOptions } from '@/store/slices/skillSlice';
import { fetchDepartmentConfigByDepartmentId } from '@/store/slices/departmentConfigurationSlice';
import { fetchDepartmentInvoiceConfigByDepartmentId } from '@/store/slices/departmentInvoiceConfigSlice';
import { formatDate, formatTime, formatPhoneNumber, formatZipCode, unformatPhoneNumber, unformatZipCode, validateEmail } from '@/utils';
import {
  computeNextDepartmentDefinedNumber,
  getDepartmentDefinedNumberYearSuffix,
} from '@/utils/departmentDefinedNumberUtils';
import './RequesterForm.css';

export interface RequesterFormProps {
  initialData?: RequesterResponse | null;
  onSuccess?: (requesterId?: string) => void;
  onCancel?: () => void;
  className?: string;
  submitButtonText?: string;
  viewMode?: boolean;
  onSwitchToEdit?: () => void;
}

interface RequesterFormData {
  departmentDefinedNumber: string;
  businessTypeID: string | null;
  status: boolean;
  name: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  phone: string;
  primaryContact: string;
  fax: string;
  secondaryContact: string;
  secondaryPhone: string;
  invoiceBillingName: string;
  invoiceContact: string;
  invoiceAddress: string;
  invoiceAddress2: string;
  invoiceCity: string;
  invoiceState: string;
  invoiceZip: string;
  invoicePhone: string;
  invoicePhoneExt: string;
  invoiceEmail: string;
  invoiceFax: string;
  isLiquorLicenseRequired: boolean;
  liquorLicense: string;
  billingNotes: string;
  comments: string;
  approvedForCivilians: boolean;
  exemptFromExtract: boolean;
  isChild: boolean;
  notificationRecipients: string;
  parentID: string | null;
  // Skills requirements
  isSkillsRequired: boolean;
  skillIDs: string[];
  isRequesterAuthorized: boolean;
}

// Field name constants to avoid hardcoded strings
const FIELD_NAMES = {
  DEPARTMENT_DEFINED_NUMBER: 'departmentDefinedNumber',
  BUSINESS_TYPE_ID: 'businessTypeID',
  STATUS: 'status',
  NAME: 'name',
  ADDRESS: 'address',
  ADDRESS2: 'address2',
  CITY: 'city',
  STATE: 'state',
  ZIP: 'zip',
  EMAIL: 'email',
  PHONE: 'phone',
  PRIMARY_CONTACT: 'primaryContact',
  FAX: 'fax',
  SECONDARY_CONTACT: 'secondaryContact',
  SECONDARY_PHONE: 'secondaryPhone',
  INVOICE_BILLING_NAME: 'invoiceBillingName',
  INVOICE_CONTACT: 'invoiceContact',
  INVOICE_ADDRESS: 'invoiceAddress',
  INVOICE_ADDRESS2: 'invoiceAddress2',
  INVOICE_CITY: 'invoiceCity',
  INVOICE_STATE: 'invoiceState',
  INVOICE_ZIP: 'invoiceZip',
  INVOICE_PHONE: 'invoicePhone',
  INVOICE_PHONE_EXT: 'invoicePhoneExt',
  INVOICE_EMAIL: 'invoiceEmail',
  INVOICE_FAX: 'invoiceFax',
  IS_LIQUOR_LICENSE_REQUIRED: 'isLiquorLicenseRequired',
  LIQUOR_LICENSE: 'liquorLicense',
  BILLING_NOTES: 'billingNotes',
  COMMENTS: 'comments',
  APPROVED_FOR_CIVILIANS: 'approvedForCivilians',
  EXEMPT_FROM_EXTRACT: 'exemptFromExtract',
  IS_CHILD: 'isChild',
  NOTIFICATION_RECIPIENTS: 'notificationRecipients',
  PARENT_ID: 'parentID',
  IS_REQUESTER_AUTHORIZED: 'isRequesterAuthorized',
} as const;

/** Map from Contact/Address fields to their corresponding Billing/Payment fields. Used to auto-populate billing info in create mode. */
const CONTACT_TO_BILLING_FIELD_MAP: Partial<Record<keyof RequesterFormData, keyof RequesterFormData>> = {
  [FIELD_NAMES.NAME]: FIELD_NAMES.INVOICE_BILLING_NAME,
  [FIELD_NAMES.PRIMARY_CONTACT]: FIELD_NAMES.INVOICE_CONTACT,
  [FIELD_NAMES.ADDRESS]: FIELD_NAMES.INVOICE_ADDRESS,
  [FIELD_NAMES.CITY]: FIELD_NAMES.INVOICE_CITY,
  [FIELD_NAMES.STATE]: FIELD_NAMES.INVOICE_STATE,
  [FIELD_NAMES.ZIP]: FIELD_NAMES.INVOICE_ZIP,
  [FIELD_NAMES.PHONE]: FIELD_NAMES.INVOICE_PHONE,
  [FIELD_NAMES.EMAIL]: FIELD_NAMES.INVOICE_EMAIL,
  [FIELD_NAMES.FAX]: FIELD_NAMES.INVOICE_FAX,
};

const BILLING_FIELDS: (keyof RequesterFormData)[] = [
  FIELD_NAMES.INVOICE_BILLING_NAME,
  FIELD_NAMES.INVOICE_CONTACT,
  FIELD_NAMES.INVOICE_ADDRESS,
  FIELD_NAMES.INVOICE_ADDRESS2,
  FIELD_NAMES.INVOICE_CITY,
  FIELD_NAMES.INVOICE_STATE,
  FIELD_NAMES.INVOICE_ZIP,
  FIELD_NAMES.INVOICE_PHONE,
  FIELD_NAMES.INVOICE_PHONE_EXT,
  FIELD_NAMES.INVOICE_EMAIL,
  FIELD_NAMES.INVOICE_FAX,
];

interface RequesterFormErrors {
  departmentDefinedNumber?: string;
  businessTypeID?: string;
  status?: string;
  name?: string;
  email?: string;
  primaryContact?: string;
  parentID?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  invoiceBillingName?: string;
  invoiceContact?: string;
  invoiceAddress?: string;
  invoiceCity?: string;
  invoiceState?: string;
  invoiceZip?: string;
  invoicePhone?: string;
  invoiceEmail?: string;
  invoiceFax?: string;
  liquorLicense?: string;
  skillIDs?: string;
}

const getDefaultFormData = (): RequesterFormData => ({
  departmentDefinedNumber: '',
  businessTypeID: null,
  status: true,
  name: '',
  address: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  email: '',
  phone: '',
  primaryContact: '',
  fax: '',
  secondaryContact: '',
  secondaryPhone: '',
  invoiceBillingName: '',
  invoiceContact: '',
  invoiceAddress: '',
  invoiceAddress2: '',
  invoiceCity: '',
  invoiceState: '',
  invoiceZip: '',
  invoicePhone: '',
  invoicePhoneExt: '',
  invoiceEmail: '',
  invoiceFax: '',
  isLiquorLicenseRequired: false,
  liquorLicense: '',
  billingNotes: '',
  comments: '',
  approvedForCivilians: true,
  exemptFromExtract: false,
  isChild: false,
  notificationRecipients: '',
  parentID: null,
  isSkillsRequired: false,
  skillIDs: [],
  isRequesterAuthorized: false,
});

const mapInitialDataToFormData = (initialData: RequesterResponse): RequesterFormData => ({
  departmentDefinedNumber: initialData.departmentDefinedNumber || '',
  businessTypeID: initialData.businessTypeID || null,
  status: initialData.status ?? true,
  name: initialData.name || '',
  address: initialData.address || '',
  address2: initialData.address2 || '',
  city: initialData.city || '',
  state: initialData.state || '',
  zip: initialData.zip || '',
  email: initialData.email || '',
  phone: initialData.phone || '',
  primaryContact: initialData.primaryContact || '',
  fax: initialData.fax || '',
  secondaryContact: initialData.secondaryContact || '',
  secondaryPhone: initialData.secondaryPhone || '',
  invoiceBillingName: initialData.invoiceBillingName || '',
  invoiceContact: initialData.invoiceContact || '',
  invoiceAddress: initialData.invoiceAddress || '',
  invoiceAddress2: initialData.invoiceAddress2 || '',
  invoiceCity: initialData.invoiceCity || '',
  invoiceState: initialData.invoiceState || '',
  invoiceZip: initialData.invoiceZip || '',
  invoicePhone: initialData.invoicePhone || '',
  invoicePhoneExt: initialData.invoicePhoneExt || '',
  invoiceEmail: initialData.invoiceEmail || '',
  invoiceFax: initialData.invoiceFax || '',
  isLiquorLicenseRequired: initialData.isLiquorLicenseRequired ?? false,
  liquorLicense: initialData.liquorLicense || '',
  billingNotes: initialData.billingNotes || '',
  comments: initialData.comments || '',
  approvedForCivilians: initialData.approvedForCivilians ?? true,
  exemptFromExtract: initialData.exemptFromExtract ?? false,
  isChild: initialData.isChild ?? false,
  notificationRecipients: initialData.notificationRecipients || '',
  parentID: initialData.parentID || null,
  isSkillsRequired: initialData.isSkillsRequired ?? false,
  skillIDs: (initialData.skillIDs as string[] | null | undefined) ?? [],
  isRequesterAuthorized: (initialData as any).isRequesterAuthorized ?? false,
});

export const RequesterForm: React.FC<RequesterFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
  viewMode = false,
}) => {
  const [formData, setFormData] = useState<RequesterFormData>(() =>
    initialData ? mapInitialDataToFormData(initialData) : getDefaultFormData()
  );
  // Single checkbox to show all secondary contact info fields
  const [showSecondaryContactInfo, setShowSecondaryContactInfo] = useState(false);
  const [showPayAddress2, setShowPayAddress2] = useState(false);
  /** When false (create mode), billing fields will mirror Contact/Address updates until the user edits any billing field. */
  const [hasUserEditedBilling, setHasUserEditedBilling] = useState<boolean>(Boolean(initialData));

  useEffect(() => {
    if (initialData) {
      setFormData(mapInitialDataToFormData(initialData));
      // When editing, show secondary contact info checkbox if any of the fields have data
      const hasSecondaryContactInfo = Boolean(
        (initialData.secondaryContact && initialData.secondaryContact.trim()) ||
        (initialData.secondaryPhone && initialData.secondaryPhone.trim()) ||
        (initialData.address2 && initialData.address2.trim())
      );
      setShowSecondaryContactInfo(hasSecondaryContactInfo);
      setShowPayAddress2(Boolean(initialData.invoiceAddress2 && initialData.invoiceAddress2.trim()));
    } else {
      setFormData(getDefaultFormData());
      setShowSecondaryContactInfo(false);
      setShowPayAddress2(false);
      setHasUserEditedBilling(false);
    }
  }, [initialData]);

  const dispatch = useAppDispatch();
  const { isLoading, requesters, requesterOptions: requesterOptionList } = useAppSelector((state) => state.requester);
  const { businessTypeOptions: businessTypeSelectOptions, isLoading: isBusinessTypeOptionsLoading } =
    useAppSelector((state) => state.businessType);
  const { skillOptions: skillSelectOptions } = useAppSelector((state) => state.skill);
  const { user } = useAppSelector((state) => state.auth);
  const departmentId = user?.departmentID;
  const departmentConfigurationState = useAppSelector((state) => state.departmentConfiguration);
  const departmentInvoiceConfigState = useAppSelector((state) => state.departmentInvoiceConfig);
  const departmentConfig = departmentId
    ? departmentConfigurationState.configByDepartmentId[departmentId] ?? null
    : null;
  const departmentInvoiceConfig = departmentId
    ? departmentInvoiceConfigState.configByDepartmentId[departmentId] ?? null
    : null;
  const departmentConfigLoaded = Boolean(
    departmentId && departmentId in departmentConfigurationState.configByDepartmentId
  );
  const departmentConfigLoading = Boolean(
    departmentId && departmentConfigurationState.loadingByDepartmentId[departmentId]
  );
  const invoiceConfigLoaded = Boolean(
    departmentId && departmentId in departmentInvoiceConfigState.configByDepartmentId
  );
  const invoiceConfigLoading = Boolean(
    departmentId && departmentInvoiceConfigState.loadingByDepartmentId[departmentId]
  );
  const isAddMode = !initialData?.requesterID && !viewMode;
  const [errors, setErrors] = useState<RequesterFormErrors>({});
  const hasFetchedSkillOptionsRef = useRef(false);
  const hasFetchedRequesterOptionsRef = useRef(false);

  // Fetch business type options once (skip if already loaded or in flight).
  useEffect(() => {
    if (businessTypeSelectOptions.length > 0 || isBusinessTypeOptionsLoading) return;
    dispatch(fetchBusinessTypeOptions(undefined));
  }, [dispatch, businessTypeSelectOptions.length, isBusinessTypeOptionsLoading]);

  useEffect(() => {
    if (!formData.isSkillsRequired) {
      hasFetchedSkillOptionsRef.current = false;
      return;
    }
    if (departmentConfig?.requesterSpecificSkills === false) return;
    if (hasFetchedSkillOptionsRef.current) return;
    hasFetchedSkillOptionsRef.current = true;
    dispatch(fetchSkillOptions(undefined));
  }, [dispatch, formData.isSkillsRequired, departmentConfig?.requesterSpecificSkills]);

  useEffect(() => {
    if (!formData.isChild) {
      hasFetchedRequesterOptionsRef.current = false;
      return;
    }
    if (hasFetchedRequesterOptionsRef.current) return;
    hasFetchedRequesterOptionsRef.current = true;
    dispatch(fetchRequesterOptionsThunk({}));
  }, [dispatch, formData.isChild]);

  // Fetch department configuration once per department (cached in Redux).
  useEffect(() => {
    if (!departmentId || departmentConfigLoaded || departmentConfigLoading) return;
    dispatch(fetchDepartmentConfigByDepartmentId(departmentId));
  }, [dispatch, departmentId, departmentConfigLoaded, departmentConfigLoading]);

  // Invoice config only needed in add mode for Department Defined Number sequence.
  useEffect(() => {
    if (!isAddMode || !departmentId || invoiceConfigLoaded || invoiceConfigLoading) return;
    dispatch(fetchDepartmentInvoiceConfigByDepartmentId(departmentId));
  }, [dispatch, departmentId, isAddMode, invoiceConfigLoaded, invoiceConfigLoading]);

  // Requester list for Department Defined Number sequence in add mode only.
  useEffect(() => {
    if (!initialData?.requesterID) {
      dispatch(fetchRequesters({ page: 1, pageSize: 1000 }));
    }
  }, [dispatch, initialData?.requesterID]);

  // Add requester: auto-assign DDN as YY-000001 (YY from Department Invoice Config fiscal year when set, else current year).
  useEffect(() => {
    if (initialData?.requesterID || viewMode) return;
    const y = getDepartmentDefinedNumberYearSuffix(departmentInvoiceConfig?.fiscalYear);
    const next = computeNextDepartmentDefinedNumber(
      y,
      requesters.map((r) => r.departmentDefinedNumber)
    );
    setFormData((prev) => (prev.departmentDefinedNumber === next ? prev : { ...prev, departmentDefinedNumber: next }));
  }, [initialData?.requesterID, requesters, viewMode, departmentInvoiceConfig?.fiscalYear]);

  // Match EmployeeForm: active list may omit inactive types; still show the saved id in edit mode.
  const businessTypeOptions = useMemo(() => {
    const base = businessTypeSelectOptions.map((type) => ({
      value: type.id,
      label: type.label,
    }));
    if (!initialData?.requesterID) return base;
    const sel = formData.businessTypeID || '';
    if (!sel || base.some((o) => String(o.value) === String(sel))) return base;
    const label =
      (initialData.businessType && String(initialData.businessType).trim()) || 'Currently assigned';
    return [...base, { value: sel, label }];
  }, [businessTypeSelectOptions, formData.businessTypeID, initialData?.requesterID, initialData?.businessType]);

  const skillOptions = useMemo(
    () =>
      (skillSelectOptions ?? []).map((skill) => ({
        value: skill.id,
        label: skill.label || 'Unknown Skill',
      })),
    [skillSelectOptions]
  );

  const parentRequesterOptions = useMemo(() => {
    const base = requesterOptionList
      .filter((requester) => !initialData || requester.id !== initialData.requesterID)
      .map((requester) => ({
        value: requester.id,
        label: requester.label || requester.id,
      }));
    const sel = formData.parentID || '';
    if (!sel || base.some((o) => String(o.value) === String(sel))) return base;
    return [...base, { value: sel, label: 'Currently assigned' }];
  }, [requesterOptionList, formData.parentID, initialData?.requesterID]);


  const handleChange = (field: keyof RequesterFormData, value: string | number | boolean | null) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };

      // In create mode, keep Billing/Payment fields in sync with Contact/Address
      // until the user explicitly edits any billing field.
      if (!initialData && !hasUserEditedBilling) {
        const billingField = CONTACT_TO_BILLING_FIELD_MAP[field];
        if (billingField) {
          (newData as Record<string, unknown>)[billingField as string] = value ?? '';
        }
      }

      // If isChild is being unchecked, clear parentID
      if (field === FIELD_NAMES.IS_CHILD && !value) {
        newData.parentID = null;
      }

      return newData;
    });

    // Once the user edits any billing field directly, stop auto-syncing from Contact/Address.
    if (!hasUserEditedBilling && BILLING_FIELDS.includes(field)) {
      setHasUserEditedBilling(true);
    }

    // Clear errors for this field when user changes it; when billing mirrors Contact in create mode, clear matching billing errors too.
    setErrors((prev) => {
      const next: RequesterFormErrors = { ...prev };
      let changed = false;
      if (prev[field as keyof RequesterFormErrors]) {
        (next as Record<string, unknown>)[field as string] = undefined;
        changed = true;
      }
      if (field === FIELD_NAMES.IS_LIQUOR_LICENSE_REQUIRED && !value && prev.liquorLicense) {
        next.liquorLicense = undefined;
        changed = true;
      }
      if (!initialData && !hasUserEditedBilling) {
        const billingField = CONTACT_TO_BILLING_FIELD_MAP[field];
        if (billingField) {
          const billingErrKey = billingField as keyof RequesterFormErrors;
          if (prev[billingErrKey]) {
            next[billingErrKey] = undefined;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: RequesterFormErrors = {};

    if (!formData.departmentDefinedNumber.trim()) {
      newErrors.departmentDefinedNumber = REQUESTER.ERRORS.DEPARTMENT_DEFINED_NUMBER_REQUIRED;
    }

    if (!formData.businessTypeID || !formData.businessTypeID.trim()) {
      newErrors.businessTypeID = REQUESTER.ERRORS.BUSINESS_TYPE_REQUIRED;
    }

    if (!formData.name.trim()) {
      newErrors.name = REQUESTER.ERRORS.NAME_REQUIRED;
    }

    if (!formData.primaryContact.trim()) {
      newErrors.primaryContact = REQUESTER.ERRORS.PRIMARY_CONTACT_REQUIRED;
    }

    if (!formData.email.trim()) {
      newErrors.email = REQUESTER.ERRORS.EMAIL_REQUIRED;
    } else if (!validateEmail(formData.email)) {
      newErrors.email = REQUESTER.ERRORS.EMAIL_INVALID;
    }

    // Parent requester is required when isChild is true
    if (formData.isChild && (!formData.parentID || !formData.parentID.trim())) {
      // Add a custom error for parentID
      (newErrors as any).parentID = REQUESTER.ERRORS.PARENT_REQUESTER_REQUIRED;
    }
    if (!formData.address.trim()) {
    newErrors.address = REQUESTER.ERRORS.ADDRESS_REQUIRED;
    }
   if (!formData.city.trim()) {
    newErrors.city = REQUESTER.ERRORS.CITY_REQUIRED;
   }
if (!formData.state.trim()) {
  newErrors.state = REQUESTER.ERRORS.STATE_REQUIRED;
}
if (!formData.zip.trim()) {
  newErrors.zip = REQUESTER.ERRORS.ZIP_REQUIRED;
}
if (!formData.phone.trim()) {
  newErrors.phone = REQUESTER.ERRORS.PHONE_REQUIRED;
}

    // Billing / Payment Information validations
    if (!formData.invoiceBillingName.trim()) {
      newErrors.invoiceBillingName = REQUESTER.ERRORS.PAYER_BILLING_NAME_REQUIRED;
    }

    if (!formData.invoiceContact.trim()) {
      newErrors.invoiceContact = REQUESTER.ERRORS.PAY_CONTACT_REQUIRED;
    }

    if (!formData.invoiceAddress.trim()) {
      newErrors.invoiceAddress = REQUESTER.ERRORS.PAY_ADDRESS_REQUIRED;
    }

    if (!formData.invoiceCity.trim()) {
      newErrors.invoiceCity = REQUESTER.ERRORS.PAY_CITY_REQUIRED;
    }

    if (!formData.invoiceState.trim()) {
      newErrors.invoiceState = REQUESTER.ERRORS.PAY_STATE_REQUIRED;
    }

    if (!formData.invoiceZip.trim()) {
      newErrors.invoiceZip = REQUESTER.ERRORS.PAY_ZIP_REQUIRED;
    }

    if (!formData.invoicePhone.trim()) {
      newErrors.invoicePhone = REQUESTER.ERRORS.PAY_PHONE_REQUIRED;
    }

    if (!formData.invoiceEmail.trim()) {
      newErrors.invoiceEmail = REQUESTER.ERRORS.PAY_EMAIL_REQUIRED;
    } else if (!validateEmail(formData.invoiceEmail)) {
      newErrors.invoiceEmail = REQUESTER.ERRORS.EMAIL_INVALID;
    }

    if (formData.isLiquorLicenseRequired && !formData.liquorLicense.trim()) {
      newErrors.liquorLicense = REQUESTER.ERRORS.LIQUOR_LICENSE_REQUIRED;
    }

    if (formData.isSkillsRequired && (!formData.skillIDs || formData.skillIDs.length === 0)) {
      newErrors.skillIDs = (POST.ERRORS && (POST.ERRORS as any).SKILLS_REQUIRED) || 'Please select at least one skill.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Unformat fields
      const processedData = {
        ...formData,
        phone: unformatPhoneNumber(formData.phone),
        fax: unformatPhoneNumber(formData.fax),
        zip: unformatZipCode(formData.zip),
        invoicePhone: unformatPhoneNumber(formData.invoicePhone),
        invoiceFax: unformatPhoneNumber(formData.invoiceFax),
        invoiceZip: unformatZipCode(formData.invoiceZip),
        // When Liquor License Required is unchecked, omit liquor license so API receives null
        liquorLicense: formData.isLiquorLicenseRequired ? formData.liquorLicense : undefined,
        // Skills
        isSkillsRequired: formData.isSkillsRequired,
        skillIDs:
          formData.isSkillsRequired && formData.skillIDs && formData.skillIDs.length > 0
            ? formData.skillIDs
            : undefined,
        // Requester Authorization
        isRequesterAuthorized: formData.isRequesterAuthorized,
        // Only include secondary contact fields if checkbox is checked
        ...(showSecondaryContactInfo ? {
          secondaryContact: formData.secondaryContact || undefined,
          secondaryPhone: unformatPhoneNumber(formData.secondaryPhone || ''),
          address2: formData.address2 || undefined,
        } : {
          secondaryContact: undefined,
          secondaryPhone: undefined,
          address2: undefined,
        }),
      };

      if (initialData?.requesterID) {
        // Update existing requester
        const payload: UpdateRequesterRequest = {
          requesterID: initialData.requesterID,
          ...processedData,
        };

        await dispatch(upsertRequesterThunk(payload)).unwrap();
        // When Liquor License Required was unchecked, clear the field in form state (removes text on Update)
        if (!formData.isLiquorLicenseRequired) {
          setFormData((prev) => ({ ...prev, liquorLicense: '' }));
        }
        if (onSuccess) {
          onSuccess(initialData.requesterID);
        }
      } else {
        // Create new requester
        const payload: CreateRequesterRequest = {
          ...processedData,
        };

        const response = await dispatch(upsertRequesterThunk(payload)).unwrap();
        if (onSuccess) {
          onSuccess(response.requesterID);
        }
      }
    } catch (error) {
      // Always show the generic error message, don't show detailed server errors
      dispatch(addToast({ message: REQUESTER.ERRORS.SUBMIT_FAILED, type: 'error' }));
    }
  };

  const isEditMode = Boolean(initialData?.requesterID);

  // Helper function to get business type name from ID
  const getBusinessTypeName = (businessTypeID: string | null | undefined): string => {
    if (!businessTypeID) return '-';
    const businessType = businessTypeSelectOptions.find((bt) => bt.id === businessTypeID);
    if (businessType) return businessType.label;
    if (initialData?.businessType && String(initialData.businessType).trim()) {
      return String(initialData.businessType).trim();
    }
    return '-';
  };

  // Helper function to get parent requester information
  const getParentRequesterInfo = (parentID: string | null | undefined) => {
    if (!parentID) return null;
    const parentRequester = requesterOptionList.find((requester) => requester.id === parentID);
    return parentRequester ? { requesterID: parentRequester.id, name: parentRequester.label } : null;
  };

  // Render view mode data display
  const renderViewMode = () => {
    if (!initialData) return null;

    return (
      <SMSBox component="div" className="requester-form__view-mode">
        {/* Basic Information Section */}
        <FormViewSection title={REQUESTER.FORM.SECTION_BASIC_INFO}>
          <DataDisplay label="Department Defined Number" value={initialData.departmentDefinedNumber} />
          <DataDisplay label="Name" value={initialData.name} />
          <DataDisplay label="Business Type" value={getBusinessTypeName(initialData.businessTypeID)} />
          <DataDisplay label="Status" value={initialData.status ? 'Active' : 'Inactive'} />
        </FormViewSection>

        {/* Contact and Address Information - Contact first, then Address */}
        <FormViewSection title={REQUESTER.FORM.SECTION_CONTACT_AND_ADDRESS}>
          <DataDisplay label="Primary Contact" value={initialData.primaryContact} />
          <DataDisplay label="Phone" value={initialData.phone ? formatPhoneNumber(initialData.phone) : undefined} />
          <DataDisplay label="Email" value={initialData.email} />
          <DataDisplay label="Fax" value={initialData.fax ? formatPhoneNumber(initialData.fax) : undefined} />
          {(initialData.secondaryContact || initialData.secondaryPhone) && (
            <>
              <DataDisplay label={REQUESTER.FORM.SECONDARY_CONTACT} value={initialData.secondaryContact} />
              <DataDisplay label={REQUESTER.FORM.SECONDARY_PHONE} value={initialData.secondaryPhone ? formatPhoneNumber(initialData.secondaryPhone) : undefined} />
            </>
          )}
          <DataDisplay label="Address" value={initialData.address} fullWidth />
          <DataDisplay label="Address 2" value={initialData.address2} fullWidth />
          <DataDisplay label="City" value={initialData.city} />
          <DataDisplay label="State" value={initialData.state} />
          <DataDisplay label="Zip" value={initialData.zip} />
        </FormViewSection>

        {/* Billing/Payment Information Section */}
        <FormViewSection title={REQUESTER.FORM.SECTION_BILLING_PAYMENT}>
          <DataDisplay label="Payer Billing Name" value={initialData.invoiceBillingName} fullWidth />
          <DataDisplay label="Billing Contact" value={initialData.invoiceContact} />
          <DataDisplay label="Address" value={initialData.invoiceAddress} fullWidth />
          <DataDisplay label="City" value={initialData.invoiceCity} />
          <DataDisplay label="State" value={initialData.invoiceState} />
          <DataDisplay label="Zip" value={initialData.invoiceZip} />
          <DataDisplay label="Phone" value={initialData.invoicePhone ? formatPhoneNumber(initialData.invoicePhone) : undefined} />
          <DataDisplay label="Email" value={initialData.invoiceEmail} />
          <DataDisplay label="Liquor License Required" value={initialData.isLiquorLicenseRequired ? 'Yes' : 'No'} />
          {initialData.isLiquorLicenseRequired && (
            <DataDisplay label="Liquor License" value={initialData.liquorLicense} />
          )}
        </FormViewSection>

        {/* Additional Information Section (includes Billing Notes, Comments, Notification Recipients + Flags) */}
        <FormViewSection title={REQUESTER.FORM.SECTION_ADDITIONAL_INFO}>
          <DataDisplay label="Billing Notes" value={initialData.billingNotes} fullWidth />
          <DataDisplay label="Comments" value={initialData.comments} fullWidth />
          <DataDisplay label="Notification Recipients" value={initialData.notificationRecipients} />
          <DataDisplay label="Approved for Civilians" value={initialData.approvedForCivilians ? 'Yes' : 'No'} />
          <DataDisplay label="Exempt from Extract" value={initialData.exemptFromExtract ? 'Yes' : 'No'} />
          <DataDisplay label="Child" value={initialData.isChild ? 'Yes' : 'No'} />
          <DataDisplay label="Requester Authorized" value={(initialData as any).isRequesterAuthorized ? 'Yes' : 'No'} />
          {initialData.isChild && initialData.parentID && (
            <SMSBox component="div" className="requester-form__view-parent-info" sx={{ gridColumn: '1 / -1', width: '100%', marginTop: '0.5rem' }}>
              {(() => {
                const parentInfo = getParentRequesterInfo(initialData.parentID);
                return parentInfo ? (
                  <DataDisplay label="Parent Name" value={parentInfo.name} />
                ) : (
                  <DataDisplay label="Parent ID" value={initialData.parentID} />
                );
              })()}
            </SMSBox>
          )}
        </FormViewSection>
      </SMSBox>
    );
  };

  return (
    <SMSBox component="div" className={`app-form ${className}`}>
      {viewMode ? renderViewMode() : (
        <form onSubmit={handleSubmit} className="app-form__form" noValidate>
          {/* Basic Information Section - single row, four columns */}
          <SMSBox component="div" className="app-form__section">
            <SMSTypography variant="subtitle1" component="div" className="app-form__section-title">{REQUESTER.FORM.SECTION_BASIC_INFO}</SMSTypography>
            <SMSBox component="div" className="app-form__flex-row">
              <SMSTextField
                label={REQUESTER.FORM.DEPARTMENT_DEFINED_NUMBER}
                value={formData.departmentDefinedNumber}
                onChange={() => {}}
                placeholder=""
                helperText={errors.departmentDefinedNumber}
                error={Boolean(errors.departmentDefinedNumber)}
                name={FIELD_NAMES.DEPARTMENT_DEFINED_NUMBER}
                id={FIELD_NAMES.DEPARTMENT_DEFINED_NUMBER}
                disabled={isLoading || viewMode}
                inputProps={{ readOnly: !viewMode && !isLoading }}
                required
                fullWidth
              />
              <SMSTextField
                label={REQUESTER.FORM.NAME}
                value={formData.name}
                onChange={(e) => handleChange(FIELD_NAMES.NAME, e.target.value)}
                placeholder={REQUESTER.FORM.NAME_PLACEHOLDER}
                helperText={errors.name}
                error={Boolean(errors.name)}
                name={FIELD_NAMES.NAME}
                id={FIELD_NAMES.NAME}
                disabled={isLoading || viewMode}
                required
                fullWidth
              />
              <SMSDropdown
                label={REQUESTER.FORM.BUSINESS_TYPE_ID}
                options={businessTypeOptions}
                value={formData.businessTypeID || ''}
                onChange={(e) => handleChange(FIELD_NAMES.BUSINESS_TYPE_ID, (e.target.value as string) || null)}
                disabled={isLoading || viewMode}
                helperText={errors.businessTypeID}
                error={Boolean(errors.businessTypeID)}
                name={FIELD_NAMES.BUSINESS_TYPE_ID}
                id={FIELD_NAMES.BUSINESS_TYPE_ID}
                required
                fullWidth
              />
              <SMSDropdown
                label={REQUESTER.FORM.STATUS}
                options={[
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ]}
                value={formData.status.toString()}
                onChange={(e) => handleChange(FIELD_NAMES.STATUS, e.target.value === 'true')}
                disabled={isLoading || viewMode}
                name={FIELD_NAMES.STATUS}
                id={FIELD_NAMES.STATUS}
                required
                fullWidth
              />
            </SMSBox>
          </SMSBox>

          {/* Contact and Address Information - Contact first, then Address (compact vertical spacing like Billing) */}
          <SMSBox component="div" className="app-form__section requester-form__section-contact-address">
            <SMSTypography variant="subtitle1" component="div" className="app-form__section-title">{REQUESTER.FORM.SECTION_CONTACT_AND_ADDRESS}</SMSTypography>
            {/* Contact: Row 1 - Primary Contact, Phone, Email, Fax */}
            <SMSBox component="div" className="app-form__flex-row">
              <SMSTextField
                label={REQUESTER.FORM.PRIMARY_CONTACT}
                value={formData.primaryContact}
                onChange={(e) => handleChange(FIELD_NAMES.PRIMARY_CONTACT, e.target.value)}
                placeholder={REQUESTER.FORM.PRIMARY_CONTACT_PLACEHOLDER}
                name={FIELD_NAMES.PRIMARY_CONTACT}
                id={FIELD_NAMES.PRIMARY_CONTACT}
                disabled={isLoading || viewMode}
                required
                helperText={errors.primaryContact}
                error={Boolean(errors.primaryContact)}
                fullWidth
              />

              <SMSTextField
                type="tel"
                label={REQUESTER.FORM.PHONE}
                value={formData.phone}
                onChange={(e) => handleChange(FIELD_NAMES.PHONE, formatPhoneNumber(e.target.value))}
                placeholder={REQUESTER.FORM.PHONE_PLACEHOLDER}
                name={FIELD_NAMES.PHONE}
                id={FIELD_NAMES.PHONE}
                disabled={isLoading || viewMode}
                required
                helperText={errors.phone}
                error={Boolean(errors.phone)}
                fullWidth
              />
              <SMSTextField
                type="email"
                label={REQUESTER.FORM.EMAIL}
                value={formData.email}
                onChange={(e) => handleChange(FIELD_NAMES.EMAIL, e.target.value)}
                placeholder={REQUESTER.FORM.EMAIL_PLACEHOLDER}
                helperText={errors.email}
                error={Boolean(errors.email)}
                name={FIELD_NAMES.EMAIL}
                id={FIELD_NAMES.EMAIL}
                disabled={isLoading || viewMode}
                required
                fullWidth
              />

              <SMSTextField
                type="tel"
                label={REQUESTER.FORM.FAX}
                value={formData.fax}
                onChange={(e) => handleChange(FIELD_NAMES.FAX, formatPhoneNumber(e.target.value))}
                placeholder={REQUESTER.FORM.FAX_PLACEHOLDER}
                name={FIELD_NAMES.FAX}
                id={FIELD_NAMES.FAX}
                disabled={isLoading || viewMode}
                fullWidth
              />
            </SMSBox>

            {/* Address: single row - Address, City, State, Zip */}
            <SMSBox component="div" className="app-form__flex-row">
              <SMSTextField
                label={REQUESTER.FORM.ADDRESS}
                value={formData.address}
                onChange={(e) => handleChange(FIELD_NAMES.ADDRESS, e.target.value)}
                placeholder={REQUESTER.FORM.ADDRESS_PLACEHOLDER}
                name={FIELD_NAMES.ADDRESS}
                id={FIELD_NAMES.ADDRESS}
                disabled={isLoading || viewMode}
                required
                helperText={errors.address}
                error={Boolean(errors.address)}
                fullWidth
              />
              <SMSTextField
                label={REQUESTER.FORM.CITY}
                value={formData.city}
                onChange={(e) => handleChange(FIELD_NAMES.CITY, e.target.value)}
                placeholder={REQUESTER.FORM.CITY_PLACEHOLDER}
                name={FIELD_NAMES.CITY}
                id={FIELD_NAMES.CITY}
                disabled={isLoading || viewMode}
                required
                helperText={errors.city}
                error={Boolean(errors.city)}
                fullWidth
              />
              <SMSTextField
                label={REQUESTER.FORM.STATE}
                value={formData.state}
                onChange={(e) => handleChange(FIELD_NAMES.STATE, e.target.value)}
                placeholder={REQUESTER.FORM.STATE_PLACEHOLDER}
                name={FIELD_NAMES.STATE}
                id={FIELD_NAMES.STATE}
                disabled={isLoading || viewMode}
                required
                helperText={errors.state}
                error={Boolean(errors.state)}
                fullWidth
              />
              <SMSTextField
                label={REQUESTER.FORM.ZIP}
                value={formData.zip}
                onChange={(e) => handleChange(FIELD_NAMES.ZIP, formatZipCode(e.target.value))}
                placeholder={REQUESTER.FORM.ZIP_PLACEHOLDER}
                name={FIELD_NAMES.ZIP}
                id={FIELD_NAMES.ZIP}
                disabled={isLoading || viewMode}
                required
                helperText={errors.zip}
                error={Boolean(errors.zip)}
                fullWidth
              />
            </SMSBox>

            {/* Checkboxes row - Secondary Contact Info and Requester Authorized */}
            <SMSBox component="div" className="app-form__flex-row">
              <SMSBox component="div" className="app-form__checkbox-container">
                <SMSCheckbox
                  label={REQUESTER.FORM.ADD_SECONDARY_CONTACT_INFO}
                  checked={showSecondaryContactInfo}
                  onChange={(checked) => {
                    setShowSecondaryContactInfo(checked);
                  }}
                  disabled={isLoading || viewMode}
                  className="app-form__checkbox-label"
                />
              </SMSBox>
              <SMSBox component="div" className="app-form__checkbox-container">
                <SMSCheckbox
                  label="Requester Authorized"
                  checked={formData.isRequesterAuthorized}
                  onChange={(checked) => {
                    handleChange(FIELD_NAMES.IS_REQUESTER_AUTHORIZED, checked);
                  }}
                  disabled={isLoading || viewMode}
                  className="app-form__checkbox-label"
                />
              </SMSBox>
            </SMSBox>

            {/* Footer: Secondary contact info fields */}
            <SMSBox component="div" className="requester-form__section-footer">
              {showSecondaryContactInfo && (
                <SMSBox component="div" className="requester-form__footer-columns">
                  <SMSBox component="div" className="requester-form__footer-col">
                    <SMSTextField
                      label={REQUESTER.FORM.SECONDARY_CONTACT}
                      value={formData.secondaryContact}
                      onChange={(e) => handleChange(FIELD_NAMES.SECONDARY_CONTACT, e.target.value)}
                      placeholder={REQUESTER.FORM.SECONDARY_CONTACT_PLACEHOLDER}
                      name={FIELD_NAMES.SECONDARY_CONTACT}
                      id={FIELD_NAMES.SECONDARY_CONTACT}
                      disabled={isLoading || viewMode}
                      fullWidth
                    />
                  </SMSBox>
                  <SMSBox component="div" className="requester-form__footer-col">
                    <SMSTextField
                      type="tel"
                      label={REQUESTER.FORM.SECONDARY_PHONE}
                      value={formData.secondaryPhone}
                      onChange={(e) => handleChange(FIELD_NAMES.SECONDARY_PHONE, formatPhoneNumber(e.target.value))}
                      placeholder={REQUESTER.FORM.SECONDARY_PHONE_PLACEHOLDER}
                      name={FIELD_NAMES.SECONDARY_PHONE}
                      id={FIELD_NAMES.SECONDARY_PHONE}
                      disabled={isLoading || viewMode}
                      fullWidth
                    />
                  </SMSBox>
                  <SMSBox component="div" className="requester-form__footer-col">
                    <SMSTextField
                      label={REQUESTER.FORM.ADDRESS2}
                      value={formData.address2}
                      onChange={(e) => handleChange(FIELD_NAMES.ADDRESS2, e.target.value)}
                      placeholder={REQUESTER.FORM.ADDRESS2_PLACEHOLDER}
                      name={FIELD_NAMES.ADDRESS2}
                      id={FIELD_NAMES.ADDRESS2}
                      disabled={isLoading || viewMode}
                      fullWidth
                    />
                  </SMSBox>
                </SMSBox>
              )}
            </SMSBox>
          </SMSBox>

          {/* Billing/Payment Information Section */}
          <SMSBox component="div" className="app-form__section">
            <SMSTypography variant="subtitle1" component="div" className="app-form__section-title">{REQUESTER.FORM.SECTION_BILLING_PAYMENT}</SMSTypography>
            {/* First row: 4 columns (Payer Billing Name, Billing Contact, Address, optional Address 2) */}
            <SMSBox component="div" className="app-form__flex-row">
              <SMSTextField
                label={REQUESTER.FORM.PAYER_BILLING_NAME}
                value={formData.invoiceBillingName}
                onChange={(e) => handleChange(FIELD_NAMES.INVOICE_BILLING_NAME, e.target.value)}
                placeholder={REQUESTER.FORM.PAYER_BILLING_NAME_PLACEHOLDER}
                name={FIELD_NAMES.INVOICE_BILLING_NAME}
                id={FIELD_NAMES.INVOICE_BILLING_NAME}
                disabled={isLoading || viewMode}
                required
                helperText={errors.invoiceBillingName}
                error={Boolean(errors.invoiceBillingName)}
                fullWidth
              />

              <SMSTextField
                label={REQUESTER.FORM.PAY_CONTACT}
                value={formData.invoiceContact}
                onChange={(e) => handleChange(FIELD_NAMES.INVOICE_CONTACT, e.target.value)}
                placeholder={REQUESTER.FORM.PAY_CONTACT_PLACEHOLDER}
                name={FIELD_NAMES.INVOICE_CONTACT}
                id={FIELD_NAMES.INVOICE_CONTACT}
                disabled={isLoading || viewMode}
                required
                helperText={errors.invoiceContact}
                error={Boolean(errors.invoiceContact)}
                fullWidth
              />

              <SMSTextField
                label={REQUESTER.FORM.PAY_ADDRESS}
                value={formData.invoiceAddress}
                onChange={(e) => handleChange(FIELD_NAMES.INVOICE_ADDRESS, e.target.value)}
                placeholder={REQUESTER.FORM.PAY_ADDRESS_PLACEHOLDER}
                name={FIELD_NAMES.INVOICE_ADDRESS}
                id={FIELD_NAMES.INVOICE_ADDRESS}
                disabled={isLoading || viewMode}
                required
                helperText={errors.invoiceAddress}
                error={Boolean(errors.invoiceAddress)}
                fullWidth
              />

              <SMSStack direction="column" spacing={0.5} className="app-form__field" sx={{ flex: 1 }}>
                <SMSCheckbox
                  label="Add Address 2"
                  checked={showPayAddress2}
                  onChange={(checked) => setShowPayAddress2(checked)}
                  disabled={isLoading || viewMode}
                  className="app-form__checkbox-label"
                />
                {showPayAddress2 && (
                  <SMSTextField
                    value={formData.invoiceAddress2}
                    onChange={(e) => handleChange(FIELD_NAMES.INVOICE_ADDRESS2, e.target.value)}
                    placeholder={REQUESTER.FORM.PAY_ADDRESS2_PLACEHOLDER}
                    name={FIELD_NAMES.INVOICE_ADDRESS2}
                    id={FIELD_NAMES.INVOICE_ADDRESS2}
                    disabled={isLoading || viewMode}
                    fullWidth
                  />
                )}
              </SMSStack>
            </SMSBox>

            {/* City row - 4 columns: City, State, Zip, Liquor License Required (checkbox with field below) */}
            <SMSBox component="div" className="app-form__flex-row">
              <SMSTextField
                label={REQUESTER.FORM.PAY_CITY}
                value={formData.invoiceCity}
                onChange={(e) => handleChange(FIELD_NAMES.INVOICE_CITY, e.target.value)}
                placeholder={REQUESTER.FORM.PAY_CITY_PLACEHOLDER}
                name={FIELD_NAMES.INVOICE_CITY}
                id={FIELD_NAMES.INVOICE_CITY}
                disabled={isLoading || viewMode}
                required
                helperText={errors.invoiceCity}
                error={Boolean(errors.invoiceCity)}
                fullWidth
              />
              <SMSTextField
                label={REQUESTER.FORM.PAY_STATE}
                value={formData.invoiceState}
                onChange={(e) => handleChange(FIELD_NAMES.INVOICE_STATE, e.target.value)}
                placeholder={REQUESTER.FORM.PAY_STATE_PLACEHOLDER}
                name={FIELD_NAMES.INVOICE_STATE}
                id={FIELD_NAMES.INVOICE_STATE}
                disabled={isLoading || viewMode}
                required
                helperText={errors.invoiceState}
                error={Boolean(errors.invoiceState)}
                fullWidth
              />
              <SMSTextField
                label={REQUESTER.FORM.PAY_ZIP}
                value={formData.invoiceZip}
                onChange={(e) => handleChange(FIELD_NAMES.INVOICE_ZIP, formatZipCode(e.target.value))}
                placeholder={REQUESTER.FORM.PAY_ZIP_PLACEHOLDER}
                name={FIELD_NAMES.INVOICE_ZIP}
                id={FIELD_NAMES.INVOICE_ZIP}
                disabled={isLoading || viewMode}
                required
                helperText={errors.invoiceZip}
                error={Boolean(errors.invoiceZip)}
                fullWidth
              />
              <SMSStack direction="column" spacing={0.5} className="app-form__field" sx={{ flex: 1 }}>
                <SMSCheckbox
                  label="Liquor License Required"
                  checked={formData.isLiquorLicenseRequired}
                  onChange={(checked) => handleChange(FIELD_NAMES.IS_LIQUOR_LICENSE_REQUIRED, checked)}
                  disabled={isLoading || viewMode}
                  className="app-form__checkbox-label"
                />
                {formData.isLiquorLicenseRequired && (
                  <SMSTextField
                    value={formData.liquorLicense}
                    onChange={(e) => handleChange(FIELD_NAMES.LIQUOR_LICENSE, e.target.value)}
                    placeholder={REQUESTER.FORM.LIQUOR_LICENSE_PLACEHOLDER}
                    name={FIELD_NAMES.LIQUOR_LICENSE}
                    id={FIELD_NAMES.LIQUOR_LICENSE}
                    disabled={isLoading || viewMode}
                    helperText={errors.liquorLicense}
                    error={Boolean(errors.liquorLicense)}
                    fullWidth
                  />
                )}
              </SMSStack>
            </SMSBox>

            {/* Phone & Fax row - 4 columns: Phone, Phone Ext, Email, Fax */}
            <SMSBox component="div" className="app-form__flex-row" sx={{ alignItems: 'flex-start' }}>
              <SMSTextField
                type="tel"
                label={REQUESTER.FORM.PAY_PHONE}
                value={formData.invoicePhone}
                onChange={(e) => handleChange(FIELD_NAMES.INVOICE_PHONE, formatPhoneNumber(e.target.value))}
                placeholder={REQUESTER.FORM.PAY_PHONE_PLACEHOLDER}
                name={FIELD_NAMES.INVOICE_PHONE}
                id={FIELD_NAMES.INVOICE_PHONE}
                disabled={isLoading || viewMode}
                required
                helperText={errors.invoicePhone}
                error={Boolean(errors.invoicePhone)}
                fullWidth
              />
              <SMSTextField
                label={REQUESTER.FORM.PAY_PHONE_EXT}
                value={formData.invoicePhoneExt}
                onChange={(e) => handleChange(FIELD_NAMES.INVOICE_PHONE_EXT, e.target.value)}
                placeholder={REQUESTER.FORM.PAY_PHONE_EXT_PLACEHOLDER}
                name={FIELD_NAMES.INVOICE_PHONE_EXT}
                id={FIELD_NAMES.INVOICE_PHONE_EXT}
                disabled={isLoading || viewMode}
                fullWidth
              />
              <SMSTextField
                type="email"
                label={REQUESTER.FORM.PAY_EMAIL}
                value={formData.invoiceEmail}
                onChange={(e) => handleChange(FIELD_NAMES.INVOICE_EMAIL, e.target.value)}
                placeholder={REQUESTER.FORM.PAY_EMAIL_PLACEHOLDER}
                name={FIELD_NAMES.INVOICE_EMAIL}
                id={FIELD_NAMES.INVOICE_EMAIL}
                disabled={isLoading || viewMode}
                required
                helperText={errors.invoiceEmail}
                error={Boolean(errors.invoiceEmail)}
                fullWidth
              />
              <SMSTextField
                type="tel"
                label={REQUESTER.FORM.PAYER_FAX}
                value={formData.invoiceFax}
                onChange={(e) => handleChange(FIELD_NAMES.INVOICE_FAX, formatPhoneNumber(e.target.value))}
                placeholder={REQUESTER.FORM.PAYER_FAX_PLACEHOLDER}
                name={FIELD_NAMES.INVOICE_FAX}
                id={FIELD_NAMES.INVOICE_FAX}
                disabled={isLoading || viewMode}
                helperText={errors.invoiceFax}
                error={Boolean(errors.invoiceFax)}
                fullWidth
              />
            </SMSBox>
          </SMSBox>

          {/* Additional Information Section — row 1: three fields; row 2: checkboxes parallel below */}
          <SMSBox component="div" className="app-form__section">
            <SMSTypography variant="subtitle1" component="div" className="app-form__section-title">{REQUESTER.FORM.SECTION_ADDITIONAL_INFO}</SMSTypography>
            <SMSBox component="div" className="app-form__flex-row">
              <SMSTextField
                label={REQUESTER.FORM.BILLING_NOTES}
                value={formData.billingNotes}
                onChange={(e) => handleChange(FIELD_NAMES.BILLING_NOTES, e.target.value)}
                placeholder={REQUESTER.FORM.BILLING_NOTES_PLACEHOLDER}
                name={FIELD_NAMES.BILLING_NOTES}
                id={FIELD_NAMES.BILLING_NOTES}
                disabled={isLoading || viewMode}
                fullWidth
              />
              <SMSTextField
                label={REQUESTER.FORM.COMMENTS}
                value={formData.comments}
                onChange={(e) => handleChange(FIELD_NAMES.COMMENTS, e.target.value)}
                placeholder={REQUESTER.FORM.COMMENTS_PLACEHOLDER}
                name={FIELD_NAMES.COMMENTS}
                id={FIELD_NAMES.COMMENTS}
                disabled={isLoading || viewMode}
                fullWidth
              />
              <SMSTextField
                label={REQUESTER.FORM.NOTIFICATION_RECIPIENTS}
                value={formData.notificationRecipients}
                onChange={(e) => handleChange(FIELD_NAMES.NOTIFICATION_RECIPIENTS, e.target.value)}
                placeholder={REQUESTER.FORM.NOTIFICATION_RECIPIENTS_PLACEHOLDER}
                name={FIELD_NAMES.NOTIFICATION_RECIPIENTS}
                id={FIELD_NAMES.NOTIFICATION_RECIPIENTS}
                disabled={isLoading || viewMode}
                fullWidth
              />
            </SMSBox>
            <SMSBox component="div" className="app-form__flex-row" sx={{ alignItems: 'flex-start' }}>
              <SMSBox component="div" className="app-form__field" sx={{ flex: 1 }}>
                <SMSCheckbox
                  label={REQUESTER.FORM.CIVILIAN_APPROVED}
                  checked={formData.approvedForCivilians}
                  onChange={(checked) => handleChange(FIELD_NAMES.APPROVED_FOR_CIVILIANS, checked)}
                  disabled={isLoading || viewMode}
                  className="app-form__checkbox-label"
                />
              </SMSBox>
              <SMSBox component="div" className="app-form__field" sx={{ flex: 1 }}>
                <SMSCheckbox
                  label={REQUESTER.FORM.EXEMPT_FROM_EXTRACT}
                  checked={formData.exemptFromExtract}
                  onChange={(checked) => handleChange(FIELD_NAMES.EXEMPT_FROM_EXTRACT, checked)}
                  disabled={isLoading || viewMode}
                  className="app-form__checkbox-label"
                />
              </SMSBox>
          <SMSStack direction="column" spacing={0.5} className="app-form__field" sx={{ flex: 1 }}>
            <SMSCheckbox
              label={POST.FORM.LABEL_SKILLS_REQUIRED}
              checked={formData.isSkillsRequired && departmentConfig?.requesterSpecificSkills !== false}
              onChange={(checked) => {
                // If department config disables requester-specific skills, ignore user toggles.
                if (departmentConfig?.requesterSpecificSkills === false) return;
                handleChange('isSkillsRequired', checked);
                if (!checked && errors.skillIDs) {
                  setErrors((prev) => ({ ...prev, skillIDs: undefined }));
                }
              }}
              disabled={isLoading || viewMode || departmentConfig?.requesterSpecificSkills === false}
              className="app-form__checkbox-label"
            />
            {formData.isSkillsRequired && departmentConfig?.requesterSpecificSkills !== false && (
              <SMSMultiSelectDropdown
                options={skillOptions}
                value={formData.skillIDs || []}
                onChange={(value) => {
                  const skillIDs = value.map(String);
                  setFormData((prev) => ({ ...prev, skillIDs }));
                  if (skillIDs.length && errors.skillIDs) {
                    setErrors((prev) => ({ ...prev, skillIDs: undefined }));
                  }
                }}
                placeholder={POST.FORM.LABEL_SELECTED_SKILLS}
                disabled={isLoading || viewMode}
                name="skillIDs"
                id="skillIDs"
                required
                error={Boolean(errors.skillIDs)}
                helperText={errors.skillIDs}
              />
            )}
          </SMSStack>
              <SMSStack direction="column" spacing={0.5} className="app-form__field" sx={{ flex: 1 }}>
                <SMSCheckbox
                  label={REQUESTER.FORM.CHILD}
                  checked={formData.isChild}
                  onChange={(checked) => handleChange(FIELD_NAMES.IS_CHILD, checked)}
                  disabled={isLoading || viewMode}
                  className="app-form__checkbox-label"
                />
                {formData.isChild && (
                  <SMSDropdown
                    options={parentRequesterOptions}
                    value={formData.parentID || ''}
                    onChange={(e) => handleChange(FIELD_NAMES.PARENT_ID, (e.target.value as string) || null)}
                    placeholder={REQUESTER.PLACEHOLDERS.SELECT_PARENT}
                    disabled={isLoading || viewMode}
                    helperText={errors.parentID}
                    error={Boolean(errors.parentID)}
                    name={FIELD_NAMES.PARENT_ID}
                    id={FIELD_NAMES.PARENT_ID}
                    required
                    fullWidth
                  />
                )}
              </SMSStack>
            </SMSBox>
          </SMSBox>

          {/* Audit Information */}
          {isEditMode && initialData && (
            <SMSBox component="div" className="app-form__audit-footer">
              <span style={{ marginRight: '1rem' }}>
                {REQUESTER.TABLE.COLUMNS.CREATED_BY}: <strong>{initialData.createdBy || ''}</strong>
                {initialData.createdDate && ` (${formatDate(initialData.createdDate)} ${formatTime(initialData.createdDate)})`}
              </span>
              <span>
                | {REQUESTER.TABLE.COLUMNS.EDITED_BY}: <strong>{initialData.editedBy || ''}</strong>
                {initialData.editedDate && ` (${formatDate(initialData.editedDate)} ${formatTime(initialData.editedDate)})`}
              </span>
            </SMSBox>
          )}

          {/* Actions - same layout as RequesterRestrictForm / other requester forms */}
          <SMSStack direction="row" spacing={1} justifyContent="flex-end" className="requester-form__footer">
            <SMSButton
              type="button"
              className="requester-form__cancel-button"
              onClick={onCancel}
              disabled={isLoading}
            >
              {REQUESTER.FORM.CANCEL_BUTTON}
            </SMSButton>
            <SMSButton
              type="submit"
              className="requester-form__submit-button"
              disabled={isLoading}
              loading={isLoading}
            >
              {initialData ? REQUESTER.BUTTON.UPDATE : REQUESTER.BUTTON.ADD_NEW}
            </SMSButton>
          </SMSStack>
        </form>
      )}
    </SMSBox>
  );
};
