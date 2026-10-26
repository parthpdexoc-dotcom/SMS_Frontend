import React, { useCallback, useMemo, useState } from 'react';
import { SMSIcon, SMSGrid } from '@/components/smsatoms';
import { EmployeeCard } from '@/components/smsmolecules/EmployeeCard';
import { CardEditModal, type CardEditDraft } from '@/components/smsmolecules/CardEditModal';
import { PostPositionStatus } from '@/types/postPosition';
import { PlaceholderStatus, type PlaceholderDto } from '@/types/placeholder';
import './PlaceholderCardGrid.css';

export type PlaceholderCard = CardEditDraft & {
  id: string;
  /** Backend placeholder id when loaded from API; omitted for newly created rows. */
  placeholderId?: string | null;
  /** Backend `PlaceholderStatus`. New local cards default to Visible. */
  placeholderStatus?: PlaceholderStatus | null;
};

let placeholderIdCounter = 0;

function keepsExistingStatus(status?: PlaceholderStatus | null): boolean {
  return status === PlaceholderStatus.Hidden || status === PlaceholderStatus.Archived;
}

/** Create a new placeholder card with a stable id (for parent-controlled state). */
export const createPlaceholderCard = (
  partial?: Partial<Omit<PlaceholderCard, 'id'>> | PlaceholderDto
): PlaceholderCard => {
  placeholderIdCounter += 1;
  const placeholderId = String(partial?.placeholderId ?? '').trim() || null;
  return {
    id: `ph-${Date.now().toString(36)}-${placeholderIdCounter}`,
    placeholderId,
    firstName: String(partial?.firstName ?? ''),
    lastName: String(partial?.lastName ?? ''),
    employeeNumber: String(partial?.employeeNumber ?? ''),
    contactNumber: String(partial?.contactNumber ?? ''),
    enableInvoiceAndPayroll:
      partial && 'enableInvoiceAndPayroll' in partial
        ? partial.enableInvoiceAndPayroll === true
        : false,
    isUniquePerPosition: partial?.isUniquePerPosition === true,
    placeholderStatus: keepsExistingStatus(partial?.placeholderStatus)
      ? partial?.placeholderStatus
      : PlaceholderStatus.Visible,
  };
};

export interface PlaceholderCardGridProps {
  cards: PlaceholderCard[];
  onChange: (cards: PlaceholderCard[]) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  visibilitySelectedIds?: Set<string>;
  onToggleVisibilitySelect?: (id: string) => void;
  /** When false, hides the dashed "+" add card (e.g. Hidden tab). Default true. */
  showAddCard?: boolean;
  disabled?: boolean;
  className?: string;
  showValidationErrors?: boolean;
}

export const PlaceholderCardGrid: React.FC<PlaceholderCardGridProps> = ({
  cards,
  onChange,
  selectedIds,
  onToggleSelect,
  visibilitySelectedIds,
  onToggleVisibilitySelect,
  showAddCard = true,
  disabled = false,
  className = '',
  showValidationErrors = false,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const openAddModal = useCallback(() => {
    if (disabled) return;
    setModalOpen(true);
  }, [disabled]);

  const handleSave = useCallback(
    (values: CardEditDraft) => {
      const created = createPlaceholderCard(values);
      onChange([...cards, created]);
      if (!selectedIds.has(created.id)) onToggleSelect(created.id);
      setModalOpen(false);
    },
    [cards, onChange, onToggleSelect, selectedIds]
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const hasInvalidCards = useMemo(
    () =>
      cards.some(
        (c) =>
          selectedIds.has(c.id) &&
          (c.firstName.trim().length > 0 || c.lastName.trim().length > 0) &&
          (!c.firstName.trim() || !c.lastName.trim())
      ),
    [cards, selectedIds]
  );

  return (
    <>
      <SMSGrid container spacing={1} className={`placeholder-card-grid${className ? ` ${className}` : ''}`}>
        {showValidationErrors && hasInvalidCards && (
          <SMSGrid item xs={12}>
            <p className="placeholder-card-grid__error" role="alert">
              Each placeholder must have both first and last name.
            </p>
          </SMSGrid>
        )}
        {cards.map((card) => {
          const isArchived = card.placeholderStatus === PlaceholderStatus.Archived;
          const showEye =
            !isArchived && !disabled && Boolean(card.placeholderId?.trim()) && Boolean(onToggleVisibilitySelect);
          return (
            <SMSGrid item xs={12} sm={6} md={4} lg={3} xl={2} key={card.id}>
            <EmployeeCard
              className="placeholder-card-grid__display-card"
              position={{
                postPositionId: card.id,
                postID: '',
                badgeNumber: card.employeeNumber || undefined,
                firstName: card.firstName,
                lastName: card.lastName,
                primaryPhone: card.contactNumber || undefined,
                dateOfWork: '',
                postStartTime: '',
                lengthOfWork: 0,
                equipmentRequired: false,
                postPositionStatus: PostPositionStatus.Waiting,
                isUniquePerPosition: card.isUniquePerPosition,
              }}
              showCheckbox={!keepsExistingStatus(card.placeholderStatus)}
              isChecked={selectedIds.has(card.id)}
              onCheckboxChange={() => onToggleSelect(card.id)}
              showCloseButton={false}
              isHidden={keepsExistingStatus(card.placeholderStatus)}
              showVisibilityToggle={showEye}
              isVisibilitySelected={visibilitySelectedIds?.has(card.id) ?? false}
              onVisibilityToggle={() => onToggleVisibilitySelect?.(card.id)}
            />
            </SMSGrid>
          );
        })}
        {showAddCard && (
          <SMSGrid item className="placeholder-card-grid__add" xs={12} sm={6} md={4} lg={3} xl={2}>
          <button
            type="button"
            className="placeholder-card-add"
            onClick={openAddModal}
            disabled={disabled}
            aria-label="Add placeholder"
            title="Add placeholder"
          >
            <span className="placeholder-card-add__icon">
              <SMSIcon name="add" size="md" />
            </span>
          </button>
          </SMSGrid>
        )}
      </SMSGrid>
      <CardEditModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        disabled={disabled}
      />
    </>
  );
};
