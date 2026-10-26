import React, { useEffect, useMemo } from 'react';
import { SMSBox } from '@/components/smsatoms';
import { DAILY_WORKSPACE, MASTER_MAP } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDepartmentConfigByDepartmentId } from '@/store/slices/departmentConfigurationSlice';
import type { DepartmentLocationResponse } from '@/types/department';
import { EmployeeLocationMap } from '../EmployeeLocation/EmployeeLocationMap';
import { useMasterMapPoller } from './useMasterMapPoller';
import '../DailyWorkspace/DailyWorkspaceListPage.css';
import '../EmployeeLocation/EmployeeLocationPage.css';
import './MasterMapPage.css';

export const MasterMapPage: React.FC = () => {
  useMasterMapPoller();
  const dispatch = useAppDispatch();
  const { requesterCount, employees, departmentLocation, isLoading, error } = useAppSelector((state) => state.masterMap);

  const { user } = useAppSelector((state) => state.auth);
  const departmentId = user?.departmentID;
  const departmentConfig = useAppSelector((state) =>
    departmentId ? state.departmentConfiguration.configByDepartmentId[departmentId] : null
  );
  const isEnabled = departmentConfig?.enableEmployeeLocation === true;

  useEffect(() => {
    if (departmentId && !departmentConfig) {
      dispatch(fetchDepartmentConfigByDepartmentId(departmentId));
    }
  }, [dispatch, departmentId, departmentConfig]);

  // If the user configured a Department Home Location in Department Configuration,
  // ensure it is used as the default department center and pin on Master Map.
  const effectiveDepartmentLocation = useMemo<DepartmentLocationResponse | null>(() => {
    if (
      isEnabled &&
      departmentConfig?.departmentHomeLatitude != null &&
      departmentConfig?.departmentHomeLongitude != null
    ) {
      return {
        ...(departmentLocation ?? {
          departmentID: departmentId ?? '',
          departmentCode: '',
          departmentName: 'Department Home',
          city: undefined,
          state: undefined,
          zip: undefined,
          phone: undefined,
          email: undefined,
          timeZoneId: undefined,
          active: true,
        }),
        latitude: departmentConfig.departmentHomeLatitude,
        longitude: departmentConfig.departmentHomeLongitude,
        address: departmentConfig.departmentHomeLocation || departmentLocation?.address || undefined,
      };
    }
    return departmentLocation;
  }, [departmentConfig, departmentLocation, departmentId]);

  return (
    <SMSBox component="main" className="daily-workspace-list master-map">
      <SMSBox className="daily-workspace-list__header">
        <h1 className="daily-workspace-list__title">{MASTER_MAP.TITLE}</h1>
        <span className="daily-workspace-list__total">
          <span>{DAILY_WORKSPACE.TOTAL_REQUESTERS_LABEL}</span>
          <strong>{requesterCount}</strong>
        </span>
      </SMSBox>
      {error ? <SMSBox className="daily-workspace-list__error">{error}</SMSBox> : null}
      <div className="master-map__canvas">
        <EmployeeLocationMap
          employees={employees}
          selectedEmployeeId={null}
          loading={isLoading}
          departmentLocation={effectiveDepartmentLocation}
        />
      </div>
    </SMSBox>
  );
};
