import { useEffect, useMemo, useState } from 'react';
import { DepartmentConfigurationResponse } from '@/types/departmentConfiguration';
import { getDepartmentConfigurationByDepartmentId } from '@/services/departmentConfigurationService';

export interface DepartmentPolicyFeatureFlags {
  policyManagement: boolean;
  tenurePostPosition: boolean;
  tenurePolicy: boolean;
  overlapJobConflict: boolean;
  supervisorsViewLowerEmpTypeJobs: boolean;
  restrictWebLoginForNormalEmployee: boolean;
  supervisorRequired: boolean;
  generalPolicyEnabled: boolean;
}

export interface DepartmentPolicyVisibility {
  featureFlags: DepartmentPolicyFeatureFlags;
  isGeneralPolicyEnabled: boolean;
  canShowPostsTakenPerDay: boolean;
  canShowHoursPerDayWorked: boolean;
  canShowHoursPerWeekWorked: boolean;
  canShowHoursPerMonthWorked: boolean;
  canShowDeptOpenPostsTakenPerDay: boolean;
  canShowDeptOpenPostsTakenPerWeek: boolean;
  canShowTenurePostsAllowedPerWeek: boolean;
  canShowTenurePostsAllowedPerDay: boolean;
  canShowMinHoursPaid: boolean;
  canShowPreviewSection: boolean;
  canShowPositionTakenOnSameDay: boolean;
  canShowPostExemptTakenOnSameDay: boolean;
  canShowManagedPostTakenOnSameDay: boolean;
  canShowOverlapJobConflict: boolean;
  canShowSupervisorsViewLowerEmpTypeJobs: boolean;
  canShowRestrictWebLoginForNormalEmployee: boolean;
  canShowHoursPostsSection: boolean;
  canShowTenureSection: boolean;
  canShowSameDaySection: boolean;
  canShowSupervisorSection: boolean;
  canShowSupervisorInputs: boolean;
  canShowTenurePolicySection: boolean;
}

export const useDepartmentPolicyVisibility = (
  effectiveDepartmentId: string
): DepartmentPolicyVisibility => {
  const [departmentConfig, setDepartmentConfig] =
    useState<DepartmentConfigurationResponse | null>(null);

  useEffect(() => {
    if (!effectiveDepartmentId) {
      setDepartmentConfig(null);
      return;
    }

    let isActive = true;

    getDepartmentConfigurationByDepartmentId(effectiveDepartmentId)
      .then((cfg) => {
        if (isActive) {
          setDepartmentConfig(cfg ?? null);
        }
      })
      .catch(() => {
        if (isActive) {
          setDepartmentConfig(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [effectiveDepartmentId]);

  const featureFlags: DepartmentPolicyFeatureFlags = useMemo(() => {
    const cfg = departmentConfig;

    // Department Policy visibility is always driven by Department Configuration.
    // Even for super users, fields are only shown when the corresponding
    // checkbox is enabled in Department Configuration.
    const enabled = (flag?: boolean | null) => flag === true;

    return {
      policyManagement: enabled(cfg?.enablePolicyManagement),
      tenurePostPosition: enabled(cfg?.enableTenureBasedPostPosition),
      tenurePolicy: enabled(cfg?.enableTenurePolicy),
      overlapJobConflict: enabled(cfg?.enableOverlapJobConflictConfirmation),
      supervisorsViewLowerEmpTypeJobs: enabled(
        cfg?.enableSupervisorsViewingLowerEmpTypeJobs
      ),
      restrictWebLoginForNormalEmployee: enabled(
        cfg?.showRestrictWebLoginForNormalEmployee
      ),
      supervisorRequired: enabled(cfg?.isSupervisorRequired),
      // Revert to using EnablePolicyManagement as the main policy toggle
      generalPolicyEnabled: enabled(cfg?.enablePolicyManagement),
    };
  }, [departmentConfig]);

  const isGeneralPolicyEnabled = featureFlags.generalPolicyEnabled;

  const canShowPostsTakenPerDay = featureFlags.policyManagement;
  const canShowHoursPerDayWorked = featureFlags.policyManagement;
  const canShowHoursPerWeekWorked = featureFlags.policyManagement;
  const canShowHoursPerMonthWorked = featureFlags.policyManagement;
  const canShowDeptOpenPostsTakenPerDay = featureFlags.policyManagement;
  const canShowDeptOpenPostsTakenPerWeek = featureFlags.policyManagement;

  const canShowTenurePostsAllowedPerWeek =
    featureFlags.policyManagement || featureFlags.tenurePostPosition;
  const canShowTenurePostsAllowedPerDay =
    featureFlags.policyManagement || featureFlags.tenurePostPosition;
  const canShowMinHoursPaid = featureFlags.policyManagement;

  const canShowPreviewSection = featureFlags.policyManagement;

  const canShowPositionTakenOnSameDay = featureFlags.policyManagement;
  const canShowPostExemptTakenOnSameDay = featureFlags.policyManagement;
  const canShowManagedPostTakenOnSameDay = featureFlags.policyManagement;

  const canShowOverlapJobConflict = featureFlags.overlapJobConflict;
  const canShowSupervisorsViewLowerEmpTypeJobs =
    featureFlags.supervisorsViewLowerEmpTypeJobs;
  const canShowRestrictWebLoginForNormalEmployee =
    featureFlags.restrictWebLoginForNormalEmployee;

  const canShowHoursPostsSection =
    canShowPostsTakenPerDay ||
    canShowHoursPerDayWorked ||
    canShowHoursPerWeekWorked ||
    canShowHoursPerMonthWorked ||
    canShowDeptOpenPostsTakenPerDay ||
    canShowDeptOpenPostsTakenPerWeek;

  const canShowTenureSection =
    canShowTenurePostsAllowedPerWeek ||
    canShowTenurePostsAllowedPerDay ||
    canShowMinHoursPaid;

  const canShowSameDaySection =
    canShowPositionTakenOnSameDay ||
    canShowPostExemptTakenOnSameDay ||
    canShowManagedPostTakenOnSameDay;

  const canShowSupervisorSection =
    featureFlags.supervisorRequired ||
    featureFlags.overlapJobConflict ||
    featureFlags.supervisorsViewLowerEmpTypeJobs;
  const canShowSupervisorInputs = featureFlags.supervisorRequired;

  const canShowTenurePolicySection = featureFlags.tenurePolicy;

  return {
    featureFlags,
    isGeneralPolicyEnabled,
    canShowPostsTakenPerDay,
    canShowHoursPerDayWorked,
    canShowHoursPerWeekWorked,
    canShowHoursPerMonthWorked,
    canShowDeptOpenPostsTakenPerDay,
    canShowDeptOpenPostsTakenPerWeek,
    canShowTenurePostsAllowedPerWeek,
    canShowTenurePostsAllowedPerDay,
    canShowMinHoursPaid,
    canShowPreviewSection,
    canShowPositionTakenOnSameDay,
    canShowPostExemptTakenOnSameDay,
    canShowManagedPostTakenOnSameDay,
    canShowOverlapJobConflict,
    canShowSupervisorsViewLowerEmpTypeJobs,
    canShowRestrictWebLoginForNormalEmployee,
    canShowHoursPostsSection,
    canShowTenureSection,
    canShowSameDaySection,
    canShowSupervisorSection,
    canShowSupervisorInputs,
    canShowTenurePolicySection,
  };
};

