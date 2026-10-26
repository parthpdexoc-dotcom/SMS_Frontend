import React, { useEffect, useMemo, useRef, useState } from 'react';
import InputAdornment from '@mui/material/InputAdornment';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { SMSButton, SMSCheckbox, SMSTextField, SMSIcon, SMSPagination } from '@/components/smsatoms';
import { REQUESTER } from '@/constants/strings';
import type { SMSEmailRecipientModalProps } from './SMSEmailRecipientModal.types';
import './SMSEmailRecipientModal.css';

const modalStr = REQUESTER.EMAIL_RECIPIENT_MODAL;

export const SMSEmailRecipientModal: React.FC<SMSEmailRecipientModalProps> = ({
  isOpen,
  onClose,
  recipients,
  selectedRecipients = [],
  onConfirm,
  nameEmailOnly = false,
  serverSideSearch = false,
  onSearchChange,
  onSelectAll,
  pagination,
  title = modalStr.TITLE,
}) => {
  const [draftMap, setDraftMap] = useState<Map<string, (typeof recipients)[number]>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');

  // Keep the latest selectedRecipients without re-triggering the init effect,
  // so page changes (which re-render the parent) don't wipe in-progress selections.
  const selectedRecipientsRef = useRef(selectedRecipients);
  selectedRecipientsRef.current = selectedRecipients;

  useEffect(() => {
    if (!isOpen) return;
    setDraftMap(new Map(selectedRecipientsRef.current.map((item) => [item.id, item])));
    setSearchQuery('');
  }, [isOpen]);

  const filteredRecipients = useMemo(() => {
    if (serverSideSearch) return recipients;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((item) => {
      const haystack = [item.name, item.employeeNumber, item.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [recipients, searchQuery, serverSideSearch]);

  const draftIds = useMemo(() => new Set(draftMap.keys()), [draftMap]);

  const allSelected =
    onSelectAll && pagination
      ? pagination.totalItems > 0 && draftMap.size >= pagination.totalItems
      : filteredRecipients.length > 0 &&
        filteredRecipients.every((item) => draftIds.has(item.id));

  const updateDraft = (id: string, item: (typeof recipients)[number], selected: boolean) => {
    setDraftMap((prev) => {
      const next = new Map(prev);
      if (selected) next.set(id, item);
      else next.delete(id);
      return next;
    });
  };

  const toggleOne = (item: (typeof recipients)[number]) => {
    updateDraft(item.id, item, !draftIds.has(item.id));
  };

  const toggleAll = async () => {
    if (onSelectAll && pagination) {
      if (allSelected) {
        setDraftMap(new Map());
        return;
      }
      try {
        const all = await onSelectAll();
        setDraftMap(new Map(all.map((item) => [item.id, item])));
      } catch {
        // Fetch errors are surfaced by the caller (e.g. toast in slice)
      }
      return;
    }
    setDraftMap((prev) => {
      const next = new Map(prev);
      if (allSelected) {
        filteredRecipients.forEach((item) => next.delete(item.id));
      } else {
        filteredRecipients.forEach((item) => next.set(item.id, item));
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(draftMap.values()));
    onClose();
  };

  const selectedCount = draftMap.size;
  const addLabel = modalStr.ADD_COUNT_RECIPIENTS.replace('{count}', String(selectedCount));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg" fullWidth>
      <div className="sms-email-recipient-modal">
        <SMSTextField
          className="sms-email-recipient-modal__search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onSearchChange?.(e.target.value);
          }}
          placeholder={modalStr.SEARCH_PLACEHOLDER}
          fullWidth
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SMSIcon name="search" size="sm" />
              </InputAdornment>
            ),
          }}
        />
        <div className="sms-email-recipient-modal__table-wrap">
          <table className="sms-email-recipient-modal__table">
            <thead>
              <tr>
                <th className="sms-email-recipient-modal__check-col">
                  <SMSCheckbox
                    label={modalStr.SELECT_ALL}
                    checked={allSelected}
                    onChange={toggleAll}
                    inputProps={{ 'aria-label': modalStr.SELECT_ALL }}
                  />
                </th>
                {nameEmailOnly ? (
                  <>
                    <th>{modalStr.NAME}</th>
                    <th>{modalStr.EMAIL}</th>
                  </>
                ) : (
                  <>
                    <th>{modalStr.OFFICER_NAME}</th>
                    <th>{modalStr.EMPLOYEE_NUMBER_LABEL}</th>
                    <th>{modalStr.EMAIL}</th>
                    <th>{modalStr.TYPE}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRecipients.map((item) => (
                <tr key={item.id}>
                  <td>
                    <SMSCheckbox
                      label=""
                      checked={draftIds.has(item.id)}
                      onChange={() => toggleOne(item)}
                      inputProps={{ 'aria-label': item.name }}
                    />
                  </td>
                  {nameEmailOnly ? (
                    <>
                      <td>{item.name}</td>
                      <td>{item.email || '—'}</td>
                    </>
                  ) : (
                    <>
                      <td>{item.name}</td>
                      <td>{item.employeeNumber ?? '—'}</td>
                      <td>{item.email || '—'}</td>
                      <td>
                        <span className="sms-email-recipient-modal__type-pill">
                          {item.isPlaceholder === true
                            ? modalStr.TYPE_PLACEHOLDER
                            : modalStr.TYPE_EMPLOYEE}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <SMSPagination
            className="sms-email-recipient-modal__pagination"
            currentPage={pagination.currentPage}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={pagination.onPageChange}
            onPageSizeChange={pagination.onPageSizeChange}
            loading={pagination.loading}
          />
        ) : null}

        <div className="sms-email-recipient-modal__footer">
          <span className="sms-email-recipient-modal__count">
            {selectedCount} {modalStr.SELECTED_COUNT}
          </span>
          <div className="sms-email-recipient-modal__actions">
            <SMSButton variant="outlined" onClick={onClose}>
              {modalStr.CANCEL}
            </SMSButton>
            <SMSButton variant="contained" onClick={handleConfirm} disabled={selectedCount === 0}>
              {addLabel}
            </SMSButton>
          </div>
        </div>
      </div>
    </Modal>
  );
};
