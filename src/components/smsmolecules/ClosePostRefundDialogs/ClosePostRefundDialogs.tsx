import React from 'react';
import { RefundPaymentAllocationModal } from '@/components/smsmolecules';
import { INVOICE_GRID } from '@/constants/strings';
import type { PostCloseFormData, EquipmentDetail, VehicleDetail, QuestionnaireSubmission } from '@/types/postCloseForm';

export type ClosePostRefundPendingClose = {
  data: PostCloseFormData;
  equipmentDetails: EquipmentDetail[];
  vehicleDetails: VehicleDetail[];
  questionnaireSubmissions?: QuestionnaireSubmission[];
};

export type ClosePostRefundFlowState = {
  refundRequired: number;
  refundMessage: string;
  invoiceId: string;
  pendingClose: ClosePostRefundPendingClose;
};

export type UnclosePostRefundFlowState = {
  refundRequired: number;
  refundMessage: string;
  invoiceId: string;
  postPositionId: string;
};

type ClosePostRefundDialogsProps = {
  flow: ClosePostRefundFlowState | null;
  onClose: () => void;
  onAfterRefund: (pendingClose: ClosePostRefundPendingClose) => Promise<void>;
};

type UnclosePostRefundDialogsProps = {
  flow: UnclosePostRefundFlowState | null;
  onClose: () => void;
  onAfterRefund: (postPositionId: string) => Promise<void>;
};

const refundStrings = INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION;

export const ClosePostRefundDialogs: React.FC<ClosePostRefundDialogsProps> = ({
  flow,
  onClose,
  onAfterRefund,
}) =>
  flow ? (
    <RefundPaymentAllocationModal
      isOpen
      onClose={onClose}
      invoiceId={flow.invoiceId}
      refundRequired={flow.refundRequired}
      refundMessage={flow.refundMessage}
      afterRefundFailedMessage={refundStrings.CLOSE_AFTER_REFUND_FAILED}
      onAfterRefund={() => onAfterRefund(flow.pendingClose)}
    />
  ) : null;

export const UnclosePostRefundDialogs: React.FC<UnclosePostRefundDialogsProps> = ({
  flow,
  onClose,
  onAfterRefund,
}) =>
  flow ? (
    <RefundPaymentAllocationModal
      isOpen
      onClose={onClose}
      invoiceId={flow.invoiceId}
      refundRequired={flow.refundRequired}
      refundMessage={flow.refundMessage}
      afterRefundFailedMessage={refundStrings.UNCLOSE_AFTER_REFUND_FAILED}
      onAfterRefund={() => onAfterRefund(flow.postPositionId)}
    />
  ) : null;
