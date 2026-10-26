import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SMSFormPage } from '@/components/smsorganisms';
import { DepartmentForm, DepartmentWizardDraft } from '@/components/smsmolecules/DepartmentForm';
import { EmployeeForm } from '@/components/smsmolecules/EmployeeForm';
import { SMSBox, SMSLoader, SMSStepIndicator } from '@/components/smsatoms';
import { buildAvailableJobsLandingPathWithQuery } from '@/constants/availableJobsRouteTabs';
import { DEPARTMENT, EDIT_PROFILE } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createDepartmentThunk, fetchDepartments } from '@/store/slices/departmentSlice';
import { showToast } from '@/store/slices/toastSlice';
import { DepartmentResponse } from '@/types/department';
import { UserRoleType, hasRole } from '@/types/userRole';
import { deleteDepartment, getDepartmentById } from '@/services/departmentService';
import { uploadDepartmentLogo } from '@/services/fileUploadService';
import {
  clearWizardResume,
  pendingWizardDepartmentId,
  readPendingWizardEmployee,
  readWizardDepartmentDraft,
  rememberWizardDepartment,
  saveWizardDepartmentDraft,
  WizardEmployeeResume,
} from './wizardResume';
import './DepartmentFormPage.css';

const DEPARTMENT_LIST_QUERY = { page: 1, pageSize: 1000 };

export const DepartmentFormPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const dispatch = useAppDispatch();
  const { departments, isLoading } = useAppSelector((state) => state.department);
  const { user } = useAppSelector((state) => state.auth);

  const [editingDepartment, setEditingDepartment] = useState<DepartmentResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [wizardResume, setWizardResume] = useState<WizardEmployeeResume | null>(() =>
    pendingWizardDepartmentId() ? readPendingWizardEmployee() : null
  );
  const [currentStep, setCurrentStep] = useState<number>(wizardResume ? 2 : 1);
  const [adminStepReady, setAdminStepReady] = useState(Boolean(wizardResume));
  const departmentDraftRef = useRef<DepartmentWizardDraft | null>(null);
  const wizardSaveLock = useRef(false);
  const wizardRecoveryStarted = useRef(false);
  const wizardRecoveryAttempts = useRef(0);
  const isSettingsEditProfile = location.pathname.startsWith('/settings/edit-profile');
  const isDepartmentAdmin = hasRole(user?.roles, UserRoleType.DepartmentAdmin);
  const effectiveId = (isSettingsEditProfile ? user?.departmentID : id) ?? undefined;
  const isEditMode = Boolean(effectiveId);

  const removeWizardDepartment = useCallback(async (departmentId: string, message?: string) => {
    try {
      await deleteDepartment(departmentId);
      dispatch(showToast(message || DEPARTMENT.WIZARD.REMOVED_AFTER_ADMIN_FAILURE, 'error'));
      dispatch(fetchDepartments(DEPARTMENT_LIST_QUERY));
    } catch {
      dispatch(showToast(DEPARTMENT.WIZARD.CLEANUP_FAILED, 'error'));
    }
  }, [dispatch]);

  useEffect(() => {
    if (isSettingsEditProfile) return;
    dispatch(fetchDepartments(DEPARTMENT_LIST_QUERY));
  }, [dispatch, isSettingsEditProfile]);

  useEffect(() => {
    if (isEditMode || isSettingsEditProfile || wizardResume || departmentDraftRef.current || wizardRecoveryStarted.current) {
      return;
    }
    const employee = readPendingWizardEmployee();
    const draft = readWizardDepartmentDraft();
    if (!employee || !draft?.departmentCode || pendingWizardDepartmentId()) return;
    const code = draft.departmentCode.trim().toLowerCase();
    const match = departments.find(
      (department) => (department.departmentCode || '').trim().toLowerCase() === code
    );
    if (match?.departmentID) {
      wizardRecoveryStarted.current = true;
      rememberWizardDepartment(match.departmentID);
      setAdminStepReady(true);
      setCurrentStep(2);
      setWizardResume(employee);
      return;
    }
    if (isLoading || wizardRecoveryAttempts.current > 0) return;
    wizardRecoveryAttempts.current += 1;
    const timer = window.setTimeout(() => {
      dispatch(fetchDepartments(DEPARTMENT_LIST_QUERY));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [departments, dispatch, isEditMode, isLoading, isSettingsEditProfile, wizardResume]);

  // Find the department to edit
  useEffect(() => {
    if (!isEditMode || !effectiveId) {
      setEditingDepartment(null);
      return;
    }

    if (isSettingsEditProfile) {
      let mounted = true;
      setProfileLoading(true);
      getDepartmentById(effectiveId)
        .then((data) => {
          if (!mounted) return;
          setEditingDepartment(data ?? null);
        })
        .catch(() => {
          if (!mounted) return;
          setEditingDepartment(null);
        })
        .finally(() => {
          if (!mounted) return;
          setProfileLoading(false);
        });
      return () => {
        mounted = false;
      };
    }

    if (!isLoading && departments.length > 0) {
      const department = departments.find((d) => d.departmentID === effectiveId);
      if (department) {
        setEditingDepartment(department);
      } else {
        console.warn(`Department with ID ${effectiveId} not found`);
        navigate('/admin/department');
      }
    }
  }, [departments, effectiveId, isEditMode, isLoading, isSettingsEditProfile, navigate]);

  const handleDepartmentSuccess = () => {
    // Refresh departments list
    if (!isSettingsEditProfile) {
      dispatch(fetchDepartments(DEPARTMENT_LIST_QUERY));
    }

    if (isSettingsEditProfile && effectiveId) {
      navigate(buildAvailableJobsLandingPathWithQuery(), { replace: true });
      return;
    }

    if (isEditMode) {
      navigate(-1);
    }
  };

  const handleWizardNext = (draft: DepartmentWizardDraft) => {
    departmentDraftRef.current = draft;
    saveWizardDepartmentDraft(draft.payload);
    setAdminStepReady(true);
    setCurrentStep(2);
  };

  const resolveDepartmentId = useCallback(async () => {
    if (wizardSaveLock.current) return '';
    const existingDepartmentId = pendingWizardDepartmentId();
    if (existingDepartmentId) {
      wizardSaveLock.current = true;
      return existingDepartmentId;
    }
    const draft = departmentDraftRef.current;
    if (!draft) {
      throw new Error(DEPARTMENT.WIZARD.SAVE_STEP1_BEFORE_STEP2);
    }
    saveWizardDepartmentDraft(draft.payload);
    wizardSaveLock.current = true;
    try {
      const response = await dispatch(
        createDepartmentThunk({ ...draft.payload, suppressSuccessToast: true })
      ).unwrap();
      const departmentId = (response?.departmentID ?? '').trim();
      if (!departmentId) {
        throw new Error(DEPARTMENT.ERRORS.CREATE_RESPONSE_MISSING_ID);
      }
      rememberWizardDepartment(departmentId);
      if (draft.logoFile) {
        try {
          await uploadDepartmentLogo(departmentId, draft.logoFile);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to upload logo';
          dispatch(showToast(message, 'error'));
        }
      }
      return departmentId;
    } catch (error) {
      wizardSaveLock.current = false;
      throw error;
    }
  }, [dispatch]);

  const abandonCreatedDepartment = useCallback(async (departmentId: string, message?: string) => {
    wizardSaveLock.current = false;
    clearWizardResume();
    await removeWizardDepartment(departmentId, message);
  }, [removeWizardDepartment]);

  const handleStepClick = (step: number) => {
    if (step === currentStep) return;
    if (step === 1) {
      setCurrentStep(1);
      return;
    }
    dispatch(showToast(DEPARTMENT.WIZARD.SAVE_STEP1_BEFORE_STEP2, 'warning'));
  };

  const handleEmployeeSuccess = () => {
    clearWizardResume();
    dispatch(showToast(DEPARTMENT.SUCCESS.ADDED, 'success'));
    dispatch(fetchDepartments(DEPARTMENT_LIST_QUERY));
    navigate(-1);
  };

  const handleCancel = () => {
    navigate(-1);
  };


  const loadingPage = (title: string, subtitle?: string) => (
    <SMSFormPage title={title} subtitle={subtitle} onCancel={handleCancel}>
      <SMSBox sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <SMSLoader loadingText="Loading department data..." aria-label="Loading department data..." />
      </SMSBox>
    </SMSFormPage>
  );

  if (isSettingsEditProfile && (profileLoading || (isEditMode && !editingDepartment))) {
    return loadingPage(EDIT_PROFILE.TITLE, EDIT_PROFILE.SUBTITLE);
  }

  if (!isSettingsEditProfile && isEditMode && isLoading) {
    return loadingPage(DEPARTMENT.EDIT_TITLE);
  }

  return (
    <div className="department-form-page__container">
      {!isEditMode && (
        <SMSStepIndicator
          currentStep={currentStep}
          totalSteps={2}
          className="department-form-page__step-indicator"
          onStepClick={handleStepClick}
        />
      )}

      <SMSFormPage
        title={
          isEditMode
            ? isSettingsEditProfile
              ? EDIT_PROFILE.TITLE
              : DEPARTMENT.EDIT_TITLE
            : currentStep === 1
            ? DEPARTMENT.DETAILS_TITLE
            : DEPARTMENT.ADMIN_DETAILS_TITLE
        }
        subtitle={isSettingsEditProfile && isEditMode ? EDIT_PROFILE.SUBTITLE : undefined}
        onCancel={!isEditMode && currentStep === 2 ? () => setCurrentStep(1) : handleCancel}
        className="department-form-page__form-page"
      >
        {isEditMode ? (
          // Edit mode: Direct form without card wrapper
          <div className="department-form-page__edit-content">
            <DepartmentForm
              initialData={editingDepartment}
              onSuccess={handleDepartmentSuccess}
              onCancel={handleCancel}
              disableDepartmentIdentityFields={isSettingsEditProfile && isDepartmentAdmin}
              disableEmployeeDataFolderName={isSettingsEditProfile}
            />
          </div>
        ) : (
          // Create mode: Step-by-step wizard (same as edit mode layout)
          <div className="department-form-page__edit-content">
            <div hidden={currentStep !== 1}>
              <DepartmentForm
                onWizardNext={handleWizardNext}
                onCancel={handleCancel}
                submitButtonText="Next"
              />
            </div>
            {adminStepReady ? (
              <div hidden={currentStep !== 2}>
                <EmployeeForm
                  wizardResume={wizardResume}
                  resolveDepartmentId={resolveDepartmentId}
                  abandonCreatedDepartment={abandonCreatedDepartment}
                  onSuccess={handleEmployeeSuccess}
                  onCancel={() => setCurrentStep(1)}
                />
              </div>
            ) : null}
          </div>
        )}
      </SMSFormPage>
    </div>
  );
};
