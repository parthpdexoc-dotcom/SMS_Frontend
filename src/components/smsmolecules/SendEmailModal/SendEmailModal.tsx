import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { SMSTextField, SMSButton, SMSIcon, SMSDatePicker } from '@/components/smsatoms';
import { SMSMultiSelectDropdown } from '@/components/smsatoms/SMSMultiSelectDropdown/SMSMultiSelectDropdown';
import { RichTextEditor } from '@/components/smsmolecules/RichTextEditor/RichTextEditor';
import { SMSFieldLabel } from '@/components/smsmolecules/SMSFieldLabel';
import { SMSEmailRecipientField } from '@/components/smsmolecules/SMSEmailRecipientField';
import { SMSEmailDetailsBar } from '@/components/smsmolecules/SMSEmailDetailsBar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearNotificationForm,
  fetchAllNotificationRecipientsThunk,
  fetchNotificationDataThunk,
  sendNotificationThunk,
} from '@/store/slices/notificationSlice';
import type { NotificationRecipient } from '@/types/notification';
import { UploadFileModal } from '@/components/smsmolecules/UploadFileModal';
import { SMSEmailRecipientModal, type EmailRecipientItem } from '@/components/smsmolecules/SMSEmailRecipientModal';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { REQUESTER } from '@/constants/strings';
import {
  EMAIL_TO_PICKER_PAGE_SIZE,
  buildEmailDataParams,
  buildEmailDetailItems,
  buildEmailPostOptions,
  buildSendEmailRequest,
  emailItemToNotificationRecipient,
  getSuggestedRecipientsFromData,
  getToRecipientsFromData,
  htmlToPlainText,
  notificationRecipientToEmailItem,
  pruneSelectedRecipients,
} from '@/utils/emailUtils';
import type { SendEmailModalProps } from './SendEmailModal.types';
import './SendEmailModal.css';

const modalStr = REQUESTER.SEND_EMAIL_MODAL;

type RecipientFieldKey = 'to' | 'cc' | 'bcc';

const EMPTY_RECIPIENTS: NotificationRecipient[] = [];
const EMPTY_POST_IDS: string[] = [];

export const SendEmailModal: React.FC<SendEmailModalProps> = ({
  isOpen,
  onClose,
  context,
}) => {
  const dispatch = useAppDispatch();
  const { notificationData, assignedEmployeesTotal, isLoading, isSending } =
    useAppSelector((state) => state.notification);
  const isRequestFlow = Boolean(context?.requestId);
  const showFilters = isRequestFlow || Boolean(context?.postId);
  // Sending to one specific employee: To is pre-filled and locked
  const isSingleEmployeeFlow =
    !isRequestFlow && !context?.postId && Boolean(context?.postPositionId);

  const [subject, setSubject] = useState('');
  const [toSelected, setToSelected] = useState<NotificationRecipient[]>([]);
  const [ccSelected, setCcSelected] = useState<NotificationRecipient[]>([]);
  const [bccSelected, setBccSelected] = useState<NotificationRecipient[]>([]);
  const [message, setMessage] = useState('');
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [postOptions, setPostOptions] = useState<ReturnType<typeof buildEmailPostOptions>>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [pickerField, setPickerField] = useState<RecipientFieldKey | null>(null);
  const [toPickerSearch, setToPickerSearch] = useState('');
  const [toPickerPage, setToPickerPage] = useState(1);
  const [toPickerPageSize, setToPickerPageSize] = useState(EMAIL_TO_PICKER_PAGE_SIZE);
  const debouncedToPickerSearch = useDebounce(toPickerSearch, 500);
  const lastToPickerQueryRef = useRef('');

  const toRecipients = getToRecipientsFromData(notificationData);
  const suggestedRecipients = getSuggestedRecipientsFromData(notificationData);
  const pickerRecipients =
    pickerField === 'to'
      ? toRecipients.map(notificationRecipientToEmailItem)
      : suggestedRecipients.map(notificationRecipientToEmailItem);

  const resetForm = useCallback(() => {
    setSubject('');
    setToSelected(EMPTY_RECIPIENTS);
    setCcSelected(EMPTY_RECIPIENTS);
    setBccSelected(EMPTY_RECIPIENTS);
    setMessage('');
    setSelectedPostIds(EMPTY_POST_IDS);
    setPostOptions([]);
    setStartDate('');
    setEndDate('');
    setAttachModalOpen(false);
    setEmailAttachments([]);
    setPickerField(null);
    setToPickerSearch('');
    setToPickerPage(1);
    setToPickerPageSize(EMAIL_TO_PICKER_PAGE_SIZE);
    lastToPickerQueryRef.current = '';
  }, []);

  const contextKey =
    context?.requestId ?? context?.postId ?? context?.postPositionId ?? '';

  const buildParams = useCallback(
    (searchTerm?: string, pagination?: Parameters<typeof buildEmailDataParams>[0]['pagination']) => {
      if (!context) return {};
      return buildEmailDataParams({
        context,
        isRequestFlow,
        selectedPostIds,
        startDate,
        endDate,
        searchTerm,
        pagination,
      });
    },
    [context, isRequestFlow, selectedPostIds, startDate, endDate]
  );

  useEffect(() => {
    if (isOpen) return;
    dispatch(clearNotificationForm());
    resetForm();
  }, [isOpen, dispatch, resetForm]);

  useEffect(() => {
    if (!isOpen || !contextKey || !context) return;

    void dispatch(
      fetchNotificationDataThunk(
        buildEmailDataParams({
          context,
          isRequestFlow,
          selectedPostIds: EMPTY_POST_IDS,
          startDate: '',
          endDate: '',
        })
      )
    )
      .unwrap()
      .then(({ data }) => {
        setSubject(data.suggestedSubject ?? '');
        setMessage('');
        // Capture the full post list from the unfiltered fetch so later
        // filtered searches don't shrink the dropdown options.
        setPostOptions(buildEmailPostOptions(data));
        if (isSingleEmployeeFlow) setToSelected(getToRecipientsFromData(data));
      })
      .catch(() => {});
  }, [isOpen, contextKey, context, isRequestFlow, isSingleEmployeeFlow, dispatch]);

  useEffect(() => {
    if (pickerField !== 'to') return;
    setToPickerSearch('');
    lastToPickerQueryRef.current = '';
  }, [pickerField]);

  useEffect(() => {
    if (pickerField !== 'to') return;
    setToPickerPage(1);
  }, [debouncedToPickerSearch, pickerField]);

  useEffect(() => {
    if (pickerField !== 'to') return;
    if (toPickerSearch.trim() !== debouncedToPickerSearch.trim()) return;

    const searchTerm = debouncedToPickerSearch.trim();
    const queryKey = `${toPickerPage}|${toPickerPageSize}|${searchTerm}`;
    if (lastToPickerQueryRef.current === queryKey) return;

    void dispatch(
      fetchNotificationDataThunk(
        buildParams(searchTerm || undefined, {
          page: toPickerPage,
          pageSize: toPickerPageSize,
        })
      )
    )
      .unwrap()
      .then(() => {
        lastToPickerQueryRef.current = queryKey;
      })
      .catch(() => {});
  }, [
    pickerField,
    toPickerSearch,
    debouncedToPickerSearch,
    toPickerPage,
    toPickerPageSize,
    dispatch,
    buildParams,
  ]);

  const handleSearch = async () => {
    if (!context) return;

    try {
      const { data } = await dispatch(fetchNotificationDataThunk(buildParams())).unwrap();
      if (data.suggestedSubject) setSubject(data.suggestedSubject);
      setToSelected((prev) => pruneSelectedRecipients(prev, getToRecipientsFromData(data)));
      setCcSelected((prev) => pruneSelectedRecipients(prev, getSuggestedRecipientsFromData(data)));
      setBccSelected((prev) => pruneSelectedRecipients(prev, getSuggestedRecipientsFromData(data)));
    } catch {
      // Toast handled in slice
    }
  };

  const handleToSelectAll = async () => {
    if (assignedEmployeesTotal <= 0) return [];
    const searchTerm = debouncedToPickerSearch.trim();
    const { data } = await dispatch(
      fetchAllNotificationRecipientsThunk(
        buildParams(searchTerm || undefined, { page: 1, pageSize: assignedEmployeesTotal })
      )
    ).unwrap();
    return getToRecipientsFromData(data).map(notificationRecipientToEmailItem);
  };

  const handlePickerConfirm = (selected: EmailRecipientItem[]) => {
    const recipients = selected.map(emailItemToNotificationRecipient);
    if (pickerField === 'to') setToSelected(recipients);
    else if (pickerField === 'cc') setCcSelected(recipients);
    else if (pickerField === 'bcc') setBccSelected(recipients);
    setPickerField(null);
  };

  const detailItems = useMemo(
    () =>
      buildEmailDetailItems(notificationData, {
        requester: modalStr.REQUESTER,
        job: modalStr.JOB,
        location: modalStr.LOCATION,
      }),
    [notificationData]
  );

  const handleSend = async () => {
    if (!context || toSelected.length === 0 || !subject.trim() || !htmlToPlainText(message)) return;

    try {
      await dispatch(
        sendNotificationThunk(
          buildSendEmailRequest({
            context,
            notificationData,
            subject,
            messageHtml: message,
            toSelected,
            ccSelected,
            bccSelected,
            attachments: emailAttachments,
          })
        )
      ).unwrap();
      onClose();
    } catch {
      // Toast handled in slice
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={REQUESTER.ACTIONS.SEND_EMAIL}
      size="lg-xl"
      contentClassName="send-email-modal__content"
    >
      <div className="send-email-modal">
        {isLoading && !notificationData?.requesterName && !subject ? (
          <div className="send-email-modal__loading">{modalStr.LOADING}</div>
        ) : (
          <>
            <SMSEmailDetailsBar items={detailItems} />

            {showFilters && (
              <div
                className={`send-email-modal__filters${
                  isRequestFlow ? ' send-email-modal__filters--request' : ''
                }`}
              >
                <div className="send-email-modal__filters-row">
                  {isRequestFlow && (
                    <div className="send-email-modal__filters-post">
                      <SMSMultiSelectDropdown
                        label={modalStr.POST}
                        placeholder={modalStr.POST_PLACEHOLDER}
                        options={postOptions}
                        value={selectedPostIds}
                        onChange={(values) => setSelectedPostIds(values.map(String))}
                      />
                    </div>
                  )}
                  <SMSDatePicker
                    label={modalStr.START_DATE}
                    value={startDate || undefined}
                    onChange={(value) => setStartDate(value || '')}
                    placeholder={modalStr.DATE_PLACEHOLDER}
                    maxDate={endDate || undefined}
                  />
                  <SMSDatePicker
                    label={modalStr.END_DATE}
                    value={endDate || undefined}
                    onChange={(value) => setEndDate(value || '')}
                    placeholder={modalStr.DATE_PLACEHOLDER}
                    minDate={startDate || undefined}
                  />
                  <button
                    type="button"
                    className="send-email-modal__btn send-email-modal__btn--primary"
                    onClick={handleSearch}
                    disabled={isLoading}
                  >
                    {modalStr.SEARCH}
                  </button>
                </div>
              </div>
            )}

            <div className="send-email-modal__field">
              <SMSFieldLabel required>{modalStr.SUBJECT}</SMSFieldLabel>
              <SMSTextField value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth />
            </div>

            <SMSEmailRecipientField
              label={modalStr.TO}
              required
              addRecipientsLabel={modalStr.ADD_RECIPIENTS}
              selected={toSelected}
              onAdd={() => setPickerField('to')}
              onRemove={(id) => setToSelected((prev) => prev.filter((e) => e.employeeId !== id))}
              disabled={isSingleEmployeeFlow}
            />

            <SMSEmailRecipientField
              label={modalStr.CC}
              addRecipientsLabel={modalStr.ADD_RECIPIENTS}
              selected={ccSelected}
              onAdd={() => setPickerField('cc')}
              onRemove={(id) => setCcSelected((prev) => prev.filter((e) => e.employeeId !== id))}
            />

            <SMSEmailRecipientField
              label={modalStr.BCC}
              addRecipientsLabel={modalStr.ADD_RECIPIENTS}
              selected={bccSelected}
              onAdd={() => setPickerField('bcc')}
              onRemove={(id) => setBccSelected((prev) => prev.filter((e) => e.employeeId !== id))}
            />

            <div className="send-email-modal__field send-email-modal__field--message">
              <SMSFieldLabel required>{modalStr.MESSAGE}</SMSFieldLabel>
              <RichTextEditor
                value={message}
                onChange={setMessage}
                placeholder={modalStr.MESSAGE_PLACEHOLDER}
                minHeight="150px"
                keywords={[]}
              />
            </div>

            <div className="send-email-modal__footer">
              <button type="button" className="send-email-modal__attach-btn" onClick={() => setAttachModalOpen(true)}>
                <SMSIcon name="attach_file" size="sm" />
                {modalStr.ATTACH}
                {emailAttachments.length > 0 ? ` (${emailAttachments.length})` : ''}
              </button>
              <div className="send-email-modal__footer-actions">
                <SMSButton onClick={onClose} variant="outlined">
                  {modalStr.CANCEL}
                </SMSButton>
                <SMSButton
                  onClick={handleSend}
                  variant="contained"
                  disabled={toSelected.length === 0 || !subject.trim() || !htmlToPlainText(message) || isSending}
                  leftIcon={<SMSIcon name="send" size="sm" />}
                >
                  {isSending ? modalStr.SENDING : REQUESTER.ACTIONS.SEND_EMAIL}
                </SMSButton>
              </div>
            </div>
          </>
        )}
      </div>

      <SMSEmailRecipientModal
        isOpen={pickerField != null}
        onClose={() => {
          setPickerField(null);
          setToPickerSearch('');
        }}
        recipients={pickerRecipients}
        selectedRecipients={
          (pickerField === 'to'
            ? toSelected
            : pickerField === 'cc'
              ? ccSelected
              : bccSelected
          ).map(notificationRecipientToEmailItem)
        }
        onConfirm={handlePickerConfirm}
        nameEmailOnly={pickerField === 'cc' || pickerField === 'bcc'}
        serverSideSearch={pickerField === 'to'}
        onSearchChange={pickerField === 'to' ? setToPickerSearch : undefined}
        onSelectAll={pickerField === 'to' ? handleToSelectAll : undefined}
        title={modalStr.SELECT_RECIPIENTS}
        pagination={
          pickerField === 'to'
            ? {
                currentPage: toPickerPage,
                pageSize: toPickerPageSize,
                totalItems: assignedEmployeesTotal,
                loading: isLoading,
                onPageChange: setToPickerPage,
                onPageSizeChange: (size) => {
                  setToPickerPageSize(size);
                  setToPickerPage(1);
                },
              }
            : undefined
        }
      />

      <UploadFileModal
        isOpen={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        onUpload={(files) => {
          if (files.length > 0) setEmailAttachments((prev) => [...prev, ...files]);
        }}
        title={modalStr.ATTACH}
        oneFilePerType={false}
      />
    </Modal>
  );
};
