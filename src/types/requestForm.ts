import { RequestStatus, ReleaseAs } from './request';
import { Post } from './post';

export interface RequestFormData {
    requesterID: string;
    requesterManagerID?: string | null;
    requesterAuthorizedID?: string | null;
    enableWaitingList: boolean;
    firstName: string;
    lastName: string;
    primaryPhone: string;
    cellPhone?: string;
    secondaryPhone?: string;
    alternateCellPhone?: string;
    primaryEmail?: string;
    secondaryEmail?: string;
    isPostContact: boolean;
    startDate: string;
    endDate: string;
    title: string;
    location: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    postLocationsAreStationary: boolean;
    requiresPermit: boolean;
    permitNumber?: string;
    isSpecialEvent: boolean;
    isPremiumPaidEvent: boolean;
    specialEventApproved?: boolean;
    requiresLiquorLicense: boolean;
    liquorLicenseNumber?: string;
    alcoholPermitRequired?: boolean;
    specialRate?: number | null;
    requiresVehicle: boolean;
    requiresVehicleAtEveryPost: boolean;
    numberOfVehicles?: number;
    vehicleApproved?: boolean;
    requiresEquipment: boolean;
    requiresEquipmentAtEachPost: boolean;
    numberOfEquipment?: number;
    isSkillRequired: boolean;
    skillIDs?: string[];
    /** Number of days the request is released for (used for recurring requests). */
    releaseDays?: number;
    departmentDefinedFieldValue1?: string;
    departmentDefinedFieldValue2?: string;
    departmentDefinedFieldValue3?: string;
    departmentDefinedFieldValue4?: string;
    departmentDefinedFieldValue5?: string;
    departmentDefinedFieldValue6?: string;
    departmentDefinedFieldValue7?: string;
    departmentDefinedFieldValue8?: string;
    departmentDefinedFieldValue9?: string;
    departmentDefinedFieldValue10?: string;
    requestHasBeenUpdated: boolean;
    DepartmentResponseAreaId?: string | null;
    requestStatus: RequestStatus; // Backend property: RequestStatus (serialized as requestStatus)
    releaseAs: ReleaseAs; // Backend property: ReleaseAs (serialized as releaseAs)
    scheduleDate?: string;
    scheduledTime?: string; // Backend property: ScheduledTime (serialized as scheduledTime)
    processDate?: string; // Backend property: ProcessDate (in RequestType, for tenure-based requests, required when releaseAs is TenureBased)
    processTime?: string; // Backend property: ProcessTime (in RequestType, for tenure-based requests, required when releaseAs is TenureBased)
    notes?: string;
    comments?: string;
    posts?: Post[];
    enableFees?: boolean;
    selectedDepartmentFeeIds?: string[];
}
