import React, { useState, useEffect, useMemo } from 'react';
import { SMSButton, SMSDatePicker, SMSDropdown, SMSTimePicker } from '@/components/smsatoms';
import { BLOCK_DATE } from '@/constants/strings';
import {
  BlockDateResponse,
  BlockDateFormProps,
  BlockDateFormData,
  BlockDateFormErrors,
} from '@/types/blockDate';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertBlockDateThunk } from '@/store/slices/blockDateSlice';
import { fetchRequests } from '@/store/slices/requestSlice';
import { fetchPosts } from '@/store/slices/postSlice';
import { parseScheduleDateAndTime, combineDateAndTime, getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';
import './SMSBlockDateForm.css';

export type SMSBlockDateFormProps = BlockDateFormProps;

const getDefaultFormData = (): BlockDateFormData => ({
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  requestID: '',
  postID: '',
});

export const SMSBlockDateForm: React.FC<SMSBlockDateFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
  disableRequest = false,
  disablePost = false,
}) => {
  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector((state) => state.blockDate);
  const { requests } = useAppSelector((state) => state.request);
  const { postsByRequestId, loadingByRequestId } = useAppSelector((state) => state.post);

  const [formData, setFormData] = useState<BlockDateFormData>(() => {
    if (initialData) {
      const start = parseScheduleDateAndTime(initialData.startDateTime);
      const end = parseScheduleDateAndTime(initialData.endDateTime);
      return {
        startDate: start.scheduleDate,
        startTime: start.scheduleTime,
        endDate: end.scheduleDate,
        endTime: end.scheduleTime,
        requestID: initialData.requestID || '',
        postID: initialData.postID || '',
      };
    }
    return getDefaultFormData();
  });

  const [errors, setErrors] = useState<BlockDateFormErrors>({});
  const [, setSubmitError] = useState<string | null>(null);
  const [, setSubmitSuccess] = useState(false);

  const isEditMode = Boolean(initialData?.blockDateId);
  const isSubmitting = isLoading;

  // Load requests for the Request dropdown only; Post options are loaded when a Request is selected
  useEffect(() => {
    dispatch(fetchRequests({ page: 1, pageSize: 1000 }));
  }, [dispatch]);

  // When Request selection changes: load Posts for that request (or do not load if Request is cleared)
  useEffect(() => {
    const selectedRequestId = formData.requestID?.trim() || '';
    if (selectedRequestId) {
      dispatch(fetchPosts({ requestID: selectedRequestId, page: 1, pageSize: 1000 }));
    }
  }, [formData.requestID, dispatch]);

  useEffect(() => {
    if (initialData) {
      // Handle case where initialData has requestID/postID but no dates (pre-fill scenario)
      const hasDates = initialData.startDateTime && initialData.endDateTime;
      const start = hasDates ? parseScheduleDateAndTime(initialData.startDateTime) : { scheduleDate: '', scheduleTime: '' };
      const end = hasDates ? parseScheduleDateAndTime(initialData.endDateTime) : { scheduleDate: '', scheduleTime: '' };
      setFormData({
        startDate: start.scheduleDate || '',
        startTime: start.scheduleTime || '',
        endDate: end.scheduleDate || '',
        endTime: end.scheduleTime || '',
        requestID: initialData.requestID || '',
        postID: initialData.postID || '',
      });
    } else {
      setFormData(getDefaultFormData());
    }
    setErrors({});
    setSubmitError(null);
    setSubmitSuccess(false);
  }, [initialData]);

  const requestOptions = useMemo(() => {
    return [
      { value: '', label: BLOCK_DATE.FORM.REQUEST_PLACEHOLDER },
      ...requests.map((r) => ({
        value: r.requestID,
        label: r.title || r.requestID,
      })),
    ];
  }, [requests]);

  /* Post options: only show posts for the selected request (from API filtered by requestId). Use trimmed requestID for lookup to match the key used when storing in Redux. */
  const postOptions = useMemo(() => {
    const placeholder = { value: '', label: BLOCK_DATE.FORM.POST_PLACEHOLDER };
    const requestKey = formData.requestID?.trim() || '';
    if (!requestKey) {
      return [placeholder];
    }
    const raw = (postsByRequestId || {})[requestKey];
    const postsForRequest = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const options = [
      placeholder,
      ...postsForRequest.map((p, index) => ({
        value: p.postId?.trim() ? p.postId : `post-option-${index}`,
        label: p.postTitle || p.postId || 'Post',
      })),
    ];
    return options;
  }, [postsByRequestId, formData.requestID]);

  const requestKey = formData.requestID?.trim() || '';
  const postsLoading = Boolean(requestKey && loadingByRequestId?.[requestKey]);

  /* Debug: log Block Date dropdown data (remove when done debugging) */
  useEffect(() => {
    const requestKeyDbg = formData.requestID?.trim() || '';
    const rawDbg = requestKeyDbg ? (postsByRequestId || {})[requestKeyDbg] : null;
    const postsForRequestDbg = Array.isArray(rawDbg) ? rawDbg : rawDbg ? [rawDbg] : [];
    console.log('[BlockDateForm] Request dropdown:', {
      selectedRequestId: formData.requestID,
      requestKeyForLookup: requestKeyDbg || '(none)',
      requestOptionsCount: requestOptions.length,
      requestOptions: requestOptions,
    });
    console.log('[BlockDateForm] Post dropdown:', {
      requestKey: requestKeyDbg || '(none)',
      postsByRequestIdKeys: postsByRequestId ? Object.keys(postsByRequestId) : [],
      rawFromRedux: rawDbg,
      rawIsArray: Array.isArray(rawDbg),
      postsForRequestCount: postsForRequestDbg.length,
      postsForRequest: postsForRequestDbg,
      postOptionsCount: postOptions.length,
      postOptions: postOptions,
    });
  }, [formData.requestID, postsByRequestId, requestOptions, postOptions]);

  const handleChange = (field: keyof BlockDateFormData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      /* When request changes, clear post so user picks a post for the new request */
      if (field === 'requestID') {
        next.postID = '';
      }
      return next;
    });
    if (errors[field as keyof BlockDateFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (field === 'requestID') {
      setErrors((prev) => ({ ...prev, postID: undefined }));
    }
    if (field === 'endDate' || field === 'endTime' || field === 'startDate' || field === 'startTime') {
      setErrors((prev) => ({ ...prev, endAfterStart: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: BlockDateFormErrors = {};

    if (!formData.requestID?.trim()) {
      newErrors.requestID = BLOCK_DATE.ERRORS.REQUEST_REQUIRED;
    }
    if (!formData.postID?.trim()) {
      newErrors.postID = BLOCK_DATE.ERRORS.POST_REQUIRED;
    }
    if (!formData.startDate.trim()) {
      newErrors.startDate = BLOCK_DATE.ERRORS.START_REQUIRED;
    }
    if (!formData.startTime.trim()) {
      newErrors.startTime = BLOCK_DATE.ERRORS.START_REQUIRED;
    }
    if (!formData.endDate.trim()) {
      newErrors.endDate = BLOCK_DATE.ERRORS.END_REQUIRED;
    }
    if (!formData.endTime.trim()) {
      newErrors.endTime = BLOCK_DATE.ERRORS.END_REQUIRED;
    }

    const startIso = combineDateAndTime(formData.startDate, formData.startTime);
    const endIso = combineDateAndTime(formData.endDate, formData.endTime);
    if (startIso && endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      newErrors.endAfterStart = BLOCK_DATE.ERRORS.END_AFTER_START;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!validateForm()) {
      if (!formData.requestID?.trim()) {
        setSubmitError(BLOCK_DATE.ERRORS.REQUEST_REQUIRED);
      } else if (!formData.postID?.trim()) {
        setSubmitError(BLOCK_DATE.ERRORS.POST_REQUIRED);
      } else if (!formData.startDate || !formData.startTime) {
        setSubmitError(BLOCK_DATE.ERRORS.START_REQUIRED);
      } else if (!formData.endDate || !formData.endTime) {
        setSubmitError(BLOCK_DATE.ERRORS.END_REQUIRED);
      } else {
        setSubmitError(BLOCK_DATE.ERRORS.END_AFTER_START);
      }
      return;
    }

    const startIso = combineDateAndTime(formData.startDate, formData.startTime);
    const endIso = combineDateAndTime(formData.endDate, formData.endTime);
    if (!startIso || !endIso) {
      setSubmitError(BLOCK_DATE.ERRORS.START_REQUIRED);
      return;
    }

    const postsForRequest = (postsByRequestId || {})[formData.requestID] || [];
    const selectedPost = postsForRequest.find(
      (p, i) => (p.postId?.trim() ? p.postId : `post-option-${i}`) === formData.postID
    );
    const resolvedPostID = selectedPost?.postId?.trim() ?? (formData.postID?.startsWith('post-option-') ? null : formData.postID) ?? null;

    const payload = {
      requestID: formData.requestID || null,
      postID: resolvedPostID,
      startDateTime: startIso,
      endDateTime: endIso,
    };

    try {
      let saved: BlockDateResponse;
      if (isEditMode && initialData?.blockDateId) {
        saved = await dispatch(
          upsertBlockDateThunk({
            blockDateId: initialData.blockDateId,
            ...payload,
          })
        ).unwrap();
      } else {
        saved = await dispatch(upsertBlockDateThunk(payload)).unwrap();
      }

      setSubmitSuccess(true);
      if (!isEditMode) {
        setFormData(getDefaultFormData());
      }
      setTimeout(() => {
        setSubmitSuccess(false);
        setSubmitError(null);
        onSuccess?.(saved);
      }, 800);
    } catch {
      // Error shown via toast from slice
    }
  };

  const hasFormDataChanged = (): boolean => {
    if (!isEditMode || !initialData) return true;
    const start = parseScheduleDateAndTime(initialData.startDateTime);
    const end = parseScheduleDateAndTime(initialData.endDateTime);
    return (
      formData.startDate !== start.scheduleDate ||
      formData.startTime !== start.scheduleTime ||
      formData.endDate !== end.scheduleDate ||
      formData.endTime !== end.scheduleTime ||
      formData.requestID !== (initialData.requestID || '') ||
      formData.postID !== (initialData.postID || '')
    );
  };

  const areRequiredFieldsFilled = (): boolean => {
    return (
      (formData.requestID?.trim() ?? '') !== '' &&
      (formData.postID?.trim() ?? '') !== '' &&
      formData.startDate.trim() !== '' &&
      formData.startTime.trim() !== '' &&
      formData.endDate.trim() !== '' &&
      formData.endTime.trim() !== ''
    );
  };

  const isEndAfterStart = (): boolean => {
    const startIso = combineDateAndTime(formData.startDate, formData.startTime);
    const endIso = combineDateAndTime(formData.endDate, formData.endTime);
    if (!startIso || !endIso) return false;
    return new Date(endIso).getTime() > new Date(startIso).getTime();
  };

  const canSubmit =
    areRequiredFieldsFilled() &&
    isEndAfterStart() &&
    hasFormDataChanged() &&
    !isSubmitting;

  // Get today's date in YYYY-MM-DD format for min date restriction (local calendar day)
  const today = getLocalTodayYyyyMmDd();

  return (
    <div className={`block-date-form ${className}`}>
      <form onSubmit={handleSubmit} className="block-date-form__form">
        <div className="block-date-form__row">
          <SMSDropdown
            label={BLOCK_DATE.FORM.REQUEST}
            options={requestOptions}
            value={formData.requestID}
            onChange={(e) => handleChange('requestID', String(e.target.value))}
            placeholder={BLOCK_DATE.FORM.REQUEST_PLACEHOLDER}
            name="requestID"
            id="requestID"
            required
            error={Boolean(errors.requestID)}
            helperText={errors.requestID || undefined}
            disabled={isSubmitting || disableRequest}
            className="block-date-form__dropdown-request-post"
          />
          <SMSDropdown
            label={BLOCK_DATE.FORM.POST}
            options={postOptions}
            value={formData.postID}
            onChange={(e) => handleChange('postID', String(e.target.value))}
            placeholder={postsLoading ? 'Loading posts...' : BLOCK_DATE.FORM.POST_PLACEHOLDER}
            name="postID"
            id="postID"
            required
            error={Boolean(errors.postID)}
            helperText={errors.postID || undefined}
            disabled={isSubmitting || !formData.requestID?.trim() || postsLoading || disablePost}
            className="block-date-form__dropdown-request-post"
          />
        </div>

        <div className="block-date-form__row">
          <SMSDatePicker
            label={BLOCK_DATE.FORM.START_DATE}
            value={formData.startDate}
            onChange={(value) => handleChange('startDate', value)}
            error={errors.startDate || undefined}
            required
            name="startDate"
            id="startDate"
            disabled={isSubmitting || isEditMode}
            placeholder={BLOCK_DATE.FORM.START_DATE_PLACEHOLDER}
            minDate={today}
          />
          <SMSTimePicker
            label={BLOCK_DATE.FORM.START_TIME}
            value={formData.startTime}
            onChange={(value) => handleChange('startTime', value)}
            error={errors.startTime || undefined}
            required
            name="startTime"
            id="startTime"
            disabled={isSubmitting || isEditMode}
            placeholder={BLOCK_DATE.FORM.START_TIME_PLACEHOLDER}
            fullWidth
          />
        </div>

        <div className="block-date-form__row">
          <SMSDatePicker
            label={BLOCK_DATE.FORM.END_DATE}
            value={formData.endDate}
            onChange={(value) => handleChange('endDate', value)}
            error={errors.endDate || errors.endAfterStart || undefined}
            required
            name="endDate"
            id="endDate"
            disabled={isSubmitting}
            placeholder={BLOCK_DATE.FORM.END_DATE_PLACEHOLDER}
            minDate={today}
          />
          <SMSTimePicker
            label={BLOCK_DATE.FORM.END_TIME}
            value={formData.endTime}
            onChange={(value) => handleChange('endTime', value)}
            error={errors.endTime || undefined}
            required
            name="endTime"
            id="endTime"
            disabled={isSubmitting}
            placeholder={BLOCK_DATE.FORM.END_TIME_PLACEHOLDER}
            fullWidth
          />
        </div>

        <div className="block-date-form__footer">
          {onCancel && (
            <SMSButton
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="block-date-form__cancel-button"
            >
              {BLOCK_DATE.FORM.CANCEL_BUTTON}
            </SMSButton>
          )}
          <SMSButton
            type="submit"
            disabled={!canSubmit}
            loading={isSubmitting}
            className="block-date-form__submit-button"
            fullWidth={!onCancel}
          >
            {isEditMode ? BLOCK_DATE.BUTTON.UPDATE : BLOCK_DATE.FORM.SUBMIT_BUTTON}
          </SMSButton>
        </div>
      </form>
    </div>
  );
};
