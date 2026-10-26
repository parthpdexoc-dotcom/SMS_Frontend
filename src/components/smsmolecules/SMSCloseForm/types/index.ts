/**
 * Shared types for CloseForm and its step components.
 */
import type { ActivityFormData } from '@/types/activityForm';
import type { PostCloseFormData, EquipmentDetail, VehicleDetail } from '@/types/postCloseForm';
import type { PostPositionResponse } from '@/types/postPosition';
import type { RequestEquipmentDto } from '@/services/requestEquipmentService';

export type CloseFormStepKind =
  | 'close'
  | 'equipment'
  | 'vehicles'
  | 'split'
  | 'questionnaire-loading'
  | 'questionnaire';

export type StepFlowItem =
  | { kind: 'close' | 'equipment' | 'vehicles' | 'split'; title: string }
  | { kind: 'questionnaire-loading'; title: string }
  | { kind: 'questionnaire'; title: string; questionnaireId: string; formData: ActivityFormData };

export interface QuestionnaireStepData {
  questionnaireId: string;
  title: string;
  formData: ActivityFormData;
}

export type { PostCloseFormData, EquipmentDetail, VehicleDetail, PostPositionResponse, RequestEquipmentDto, ActivityFormData };
