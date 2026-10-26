import type {
  PostCloseFormData,
  EquipmentDetail,
  VehicleDetail,
  QuestionnaireSubmission,
} from '@/types/postCloseForm';
import type { PostPositionResponse } from '@/types/postPosition';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import type { ClosedPostPositionDetailsResponse } from '@/services/closedPostPositionEquipmentService';

export interface SMSCloseFormProps {
  postPosition: PostPositionResponse | EmployeePostListingItem;
  employeeName: string;
  employeeID: string;
  /** Optional closed-post-position details for edit prefill (history closed details API). */
  closedDetailsData?: ClosedPostPositionDetailsResponse | null;
  /** Close Assignments-only: hide questionnaire section when closed-details has no submissions. */
  hideQuestionnaireIfNoClosedSubmission?: boolean;
  /** When true, questionnaire fields are displayed but locked (read-only). */
  disableQuestionnaire?: boolean;
  /** When true, form is used for Split and step 2 shows Employee dropdown (split start time is set to current time on submit) */
  isSplitMode?: boolean;
  onSubmit?: (
    data: PostCloseFormData,
    equipmentDetails?: EquipmentDetail[],
    vehicleDetails?: VehicleDetail[],
    questionnaireSubmissions?: QuestionnaireSubmission[]
  ) => void | Promise<void>;
  onCancel?: () => void;
  /** When true, SMSButton global suspension lock is bypassed (e.g. Job Ready to Close for suspended employees). */
  allowWhenSuspended?: boolean;
}
