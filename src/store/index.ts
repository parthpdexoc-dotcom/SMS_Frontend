/**
 * Redux Store Configuration
 */
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import skillReducer from './slices/skillSlice';
import equipmentTypeReducer from './slices/equipmentTypeSlice';
import businessTypeReducer from './slices/businessTypeSlice';
import paymentTypeReducer from './slices/paymentTypeSlice';
import employeeStatusReducer from './slices/employeeStatusSlice';
import employeeReducer from './slices/employeeSlice';
import responseAreaReducer from './slices/responseAreaSlice';
import themeReducer from './slices/themeSlice';
import employeeTypeReducer from './slices/employeeTypeSlice';
import departmentDivisionsReducer from './slices/departmentDivisionsSlice';
import departmentActivityTypeReducer from './slices/departmentActivityTypeSlice';
import departmentEquipmentReducer from './slices/departmentEquipmentSlice';
import departmentAdminReducer from './slices/departmentAdminSlice';
import adminTypeReducer from './slices/adminTypeSlice';
import departmentReducer from './slices/departmentSlice';
import requesterReducer from './slices/requesterSlice';
import requestReducer from './slices/requestSlice';
import requestEquipmentReducer from './slices/requestEquipmentSlice';
import requestNoteReducer from './slices/requestNoteSlice';
import postNoteReducer from './slices/postNoteSlice';
import postEquipmentReducer from './slices/postEquipmentSlice';
import postCallSignReducer from './slices/postCallSignSlice';
import departmentDefinedFieldsReducer from './slices/departmentDefinedFieldsSlice';
import postReducer from './slices/postSlice';
import postPositionReducer from './slices/postPositionSlice';
import departmentFeeReducer from './slices/departmentFeeSlice';
import payCodeReducer from './slices/payCodeSlice';
import availablePostReducer from './slices/availablePostSlice';
import routingGroupReducer from './slices/routingGroupSlice';
import blockDateReducer from './slices/blockDateSlice';
import toastReducer from './slices/toastSlice';
import activityFormReducer from './slices/activityFormSlice';
import departmentConfigurationReducer from './slices/departmentConfigurationSlice';
import departmentInvoiceConfigReducer from './slices/departmentInvoiceConfigSlice';
import holidayDayReducer from './slices/holidayDaySlice';
import requesterRestrictedReducer from './slices/requesterRestrictedSlice';
import requesterManagerReducer from './slices/requesterManagerSlice';
import requesterAuthorizedReducer from './slices/requesterAuthorizedSlice';
import requesterEmployeeReducer from './slices/requesterEmployeeSlice';
import questionnaireReducer from './slices/questionnaireSlice';
import requesterQuestionnaireReducer from './slices/requesterQuestionnaireSlice';
import ptaeoCodeReducer from './slices/ptaeoCodeSlice';
import splitRequestReducer from './slices/splitRequestSlice';
import emailTemplateReducer from './slices/emailTemplateSlice';
import vehicleApprovalDetailReducer from './slices/approvalDetailSlice';
import invoiceReducer from './slices/invoiceSlice';
import paymentReducer from './slices/paymentSlice';
import paymentAllocationReducer from './slices/paymentAllocationSlice';
import refundPaymentReducer from './slices/refundPaymentSlice';
import refundPaymentAllocationReducer from './slices/refundPaymentAllocationSlice';
import requesterLedgerReducer from './slices/requesterLedgerSlice';
import requestApprovalRoutingReducer from './slices/requestApprovalRoutingSlice';
import rosterReducer from './slices/rosterSlice';
import tenureWaitingPositionReducer from './slices/tenureWaitingPositionSlice';
import requestScheduleReducer from './slices/requestScheduleSlice';
import employeeTenureReducer from './slices/employeeTenureSlice';
import employeeSkillReducer from './slices/employeeSkillSlice';
import placeholderReducer from './slices/placeholderSlice';
import sendAssignPostEmailReducer from './slices/sendAssignPostEmailSlice';
import notificationReducer from './slices/notificationSlice';
import auditHistoryReducer from './slices/auditHistorySlice';
import jobPositionFlowAuditReducer from './slices/jobPositionFlowAuditSlice';
import adminProfileReducer from './slices/adminProfileSlice';
import openJobsDashboardReducer from './slices/openJobsDashboardSlice';
import tenureJobsDashboardReducer from './slices/tenureJobsDashboardSlice';
import officerScheduleOverviewReducer from './slices/officerScheduleOverviewSlice';
import payrollReducer from './slices/payrollSlice';
import dailyWorkspaceReducer from './slices/dailyWorkspaceSlice';
import releaseScheduleReducer from './slices/releaseScheduleSlice';
import employeePostLocationReducer from './slices/employeePostLocationSlice';
import masterMapReducer from './slices/masterMapSlice';
import type { AuthState } from './slices/authSlice';
import type { PostState } from './slices/postSlice';
import type { AuditHistoryState } from './slices/auditHistorySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    skill: skillReducer,
    equipmentType: equipmentTypeReducer,
    businessType: businessTypeReducer,
    paymentType: paymentTypeReducer,
    employeeStatus: employeeStatusReducer,
    employeeType: employeeTypeReducer,
    departmentDivisions: departmentDivisionsReducer,
    departmentActivityType: departmentActivityTypeReducer,
    departmentEquipment: departmentEquipmentReducer,
    departmentAdmin: departmentAdminReducer,
    adminType: adminTypeReducer,
    department: departmentReducer,
    employee: employeeReducer,
    requester: requesterReducer,
    request: requestReducer,
    requestEquipment: requestEquipmentReducer,
    requestNote: requestNoteReducer,
    postNote: postNoteReducer,
    postEquipment: postEquipmentReducer,
    postCallSign: postCallSignReducer,
    departmentDefinedFields: departmentDefinedFieldsReducer,
    responseArea: responseAreaReducer,
    theme: themeReducer,
    post: postReducer,
    postPosition: postPositionReducer,
    availablePost: availablePostReducer,
    routingGroup: routingGroupReducer,
    blockDate: blockDateReducer,
    toast: toastReducer,
    departmentFee: departmentFeeReducer,
    activityForm: activityFormReducer,
    holidayDay: holidayDayReducer,
    departmentConfiguration: departmentConfigurationReducer,
    departmentInvoiceConfig: departmentInvoiceConfigReducer,
    payCode: payCodeReducer,
    requesterRestricted: requesterRestrictedReducer,
    requesterManager: requesterManagerReducer,
    requesterAuthorized: requesterAuthorizedReducer,
    requesterEmployee: requesterEmployeeReducer,
    questionnaire: questionnaireReducer,
    requesterQuestionnaire: requesterQuestionnaireReducer,
    ptaeoCode: ptaeoCodeReducer,
    splitRequest: splitRequestReducer,
    emailTemplate: emailTemplateReducer,
    vehicleApprovalDetail: vehicleApprovalDetailReducer,
    requestApprovalRouting: requestApprovalRoutingReducer,
    invoice: invoiceReducer,
    payment: paymentReducer,
    paymentAllocation: paymentAllocationReducer,
    refundPayment: refundPaymentReducer,
    refundPaymentAllocation: refundPaymentAllocationReducer,
    requesterLedger: requesterLedgerReducer,
    roster: rosterReducer,
    tenureWaitingPosition: tenureWaitingPositionReducer,
    employeeTenure: employeeTenureReducer,
    employeeSkill: employeeSkillReducer,
    placeholder: placeholderReducer,
    requestSchedule: requestScheduleReducer,
    sendAssignPostEmail: sendAssignPostEmailReducer,
    notification: notificationReducer,
    auditHistory: auditHistoryReducer,
    jobPositionFlowAudit: jobPositionFlowAuditReducer,
    adminProfile: adminProfileReducer,
    openJobsDashboard: openJobsDashboardReducer,
    tenureJobsDashboard: tenureJobsDashboardReducer,
    officerScheduleOverview: officerScheduleOverviewReducer,
    payroll: payrollReducer,
    dailyWorkspace: dailyWorkspaceReducer,
    releaseSchedule: releaseScheduleReducer,
    employeePostLocation: employeePostLocationReducer,
    masterMap: masterMapReducer,
  },
});

/** `auth` / `post` / `auditHistory` are explicitly typed — combined reducer inference can widen slices to `unknown`. */
type InferredRootState = ReturnType<typeof store.getState>;
export type RootState = Omit<InferredRootState, 'auth' | 'post' | 'auditHistory'> & {
  auth: AuthState;
  post: PostState;
  auditHistory: AuditHistoryState;
};
export type AppDispatch = typeof store.dispatch;
