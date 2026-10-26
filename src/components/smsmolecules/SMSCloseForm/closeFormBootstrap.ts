/**
 * Initial data load for SMSCloseForm: GET /Request/view-details + requester questionnaires.
 */
import type { AppDispatch } from '@/store';
import type { PostPositionResponse } from '@/types/postPosition';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import type { RequestResponse } from '@/types/request';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import { POST_POSITION } from '@/constants/strings';
import { getRequestViewDetails } from '@/services/requestViewDetailsService';
import { mapPostPositionListViewDetails } from '@/utils/mapRequestViewDetails';
import { getRequesterQuestionnairesByRequesterId } from '@/services/questionnaireService';
import { getActivityForm } from '@/services/activityFormService';
import { mapQuestionnaireFormToActivityFormData } from '@/utils/activityFormUtils';
import { showToast } from '@/store/slices/toastSlice';
import type { QuestionnaireStepData } from './types';
import { viewDetailsQueryRow } from './closeFormRowUtils';

const CF = POST_POSITION.CLOSE_FORM;

export type CloseFormBootstrapSnapshot = {
  /** When `undefined`, the caller should not update `postDetailsFromApi`. */
  postDetailsFromApi?: PostPositionResponse | null;
  cachedRequest: RequestResponse | null;
  departmentIdForEquipment: string;
  requestEquipmentRaw: PostEquipmentDto[];
  /** When `undefined`, the caller should not replace questionnaire steps. */
  questionnaireSteps?: QuestionnaireStepData[];
};

export type FetchCloseFormBootstrapArgs = {
  dispatch: AppDispatch;
  postPosition: PostPositionResponse | EmployeePostListingItem;
  postPositionId: string;
  requestId: string;
  closeFormWorkDate: string;
  userDepartmentId?: string;
  isClosedDetailsMode: boolean;
  cancelled: () => boolean;
  setQuestionnaireLoading: (loading: boolean) => void;
};

export async function fetchCloseFormBootstrap(args: FetchCloseFormBootstrapArgs): Promise<CloseFormBootstrapSnapshot> {
  const {
    dispatch,
    postPosition,
    postPositionId,
    requestId,
    closeFormWorkDate,
    userDepartmentId,
    isClosedDetailsMode,
    cancelled,
    setQuestionnaireLoading,
  } = args;

  const rawRow = postPosition as unknown as Record<string, unknown>;
  const qPostPositionId = postPositionId?.trim() || undefined;
  const qPostId = String(postPosition.postID ?? rawRow.PostID ?? rawRow.postID ?? '').trim() || undefined;
  const qRequestId = requestId?.trim() || undefined;

  if (!qPostPositionId && !qPostId && !qRequestId) {
    return {
      cachedRequest: null,
      departmentIdForEquipment: userDepartmentId ?? '',
      requestEquipmentRaw: [],
    };
  }

  const startTime = Date.now();
  const dateOfWork = closeFormWorkDate.trim().slice(0, 10) || undefined;
  const listRow = viewDetailsQueryRow(postPosition);
  const isSpecialEvent =
    listRow.isSpecialEvent === true ? true : listRow.isSpecialEvent === false ? false : undefined;

  let mapped: ReturnType<typeof mapPostPositionListViewDetails> | null = null;
  try {
    const dto = await getRequestViewDetails({
      postPositionId: qPostPositionId,
      postId: qPostId,
      requestId: qRequestId,
      dateOfWork,
      isSpecialEvent,
    });
    if (cancelled()) {
      return {
        cachedRequest: null,
        departmentIdForEquipment: userDepartmentId ?? '',
        requestEquipmentRaw: [],
      };
    }
    mapped = mapPostPositionListViewDetails(listRow, dto);
  } catch {
    if (!cancelled()) {
      dispatch(showToast(POST_POSITION.BY_STATUS_LIST.LOAD_DETAILS_ERROR, 'error'));
    }
  }

  if (cancelled()) {
    return {
      cachedRequest: null,
      departmentIdForEquipment: userDepartmentId ?? '',
      requestEquipmentRaw: [],
    };
  }

  let nextPostDetails: PostPositionResponse | null | undefined;
  if (mapped?.postDetailsFromApi) {
    nextPostDetails = mapped.postDetailsFromApi;
  }

  const request = mapped?.requestData ?? null;
  const deptId =
    userDepartmentId ||
    request?.departmentID ||
    (request as unknown as Record<string, unknown>)?.DepartmentID ||
    '';
  const departmentIdForEquipment = deptId ? String(deptId) : '';

  const postDetails = mapped?.postDetailsFromApi;
  const postRaw = postDetails == null ? null : (postDetails as unknown as Record<string, unknown>);
  const showVehicle =
    Boolean(mapped?.viewDetailsShowVehicle) ||
    Boolean(postRaw?.ShowVehicle === true || postRaw?.showVehicle === true);
  const showEquipment =
    Boolean(mapped?.viewDetailsShowEquipment) ||
    Boolean(postRaw?.ShowEquipment === true || postRaw?.showEquipment === true);
  const mergedEquipment = mapped?.detailModalEquipmentRaw ?? [];
  const requestEquipmentRaw =
    showVehicle || showEquipment || mergedEquipment.length > 0 ? mergedEquipment : [];

  const requesterId =
    request?.requesterID ??
    ((request as unknown as Record<string, unknown>)?.RequesterID as string | undefined);

  let questionnaireSteps: QuestionnaireStepData[] | undefined;

  if (isClosedDetailsMode) {
    if (!cancelled()) setQuestionnaireLoading(false);
  } else if (requesterId) {
    setQuestionnaireLoading(true);
    try {
      const requesterQuestionnaires = await getRequesterQuestionnairesByRequesterId(requesterId);
      if (cancelled()) {
        questionnaireSteps = undefined;
      } else if (!requesterQuestionnaires?.length) {
        questionnaireSteps = [];
      } else {
        const formResponses = await Promise.all(
          requesterQuestionnaires.map((rq) =>
            getActivityForm(rq.questionnaireId).catch((err) => {
              console.error('❌ CloseForm - Failed to fetch activity form:', err);
              return null;
            })
          )
        );
        if (cancelled()) {
          questionnaireSteps = undefined;
        } else {
          questionnaireSteps = formResponses
            .filter((res): res is NonNullable<typeof res> => res !== null)
            .map((res) => ({
              questionnaireId: res.questionnaire.questionnaireId,
              title: res.questionnaire.title || CF.DEFAULT_QUESTIONNAIRE_TITLE,
              formData: mapQuestionnaireFormToActivityFormData(res),
            }));
        }
      }
    } catch (err) {
      if (!cancelled()) {
        console.error('❌ CloseForm - Failed to fetch questionnaires:', err);
        questionnaireSteps = [];
      }
    } finally {
      const elapsed = Date.now() - startTime;
      const MIN_LOADING_MS = 2500;
      const remaining = MIN_LOADING_MS - elapsed;
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      if (!cancelled()) setQuestionnaireLoading(false);
    }
  } else if (!cancelled()) {
    questionnaireSteps = [];
  }

  return {
    ...(nextPostDetails !== undefined ? { postDetailsFromApi: nextPostDetails } : {}),
    cachedRequest: request,
    departmentIdForEquipment,
    requestEquipmentRaw,
    ...(questionnaireSteps !== undefined ? { questionnaireSteps } : {}),
  };
}
