import React from 'react';
import {
  SMSDialog,
  SMSDialogContent,
  SMSDialogActions,
  SMSStandardDialogHeader,
} from '@/components/smsatoms';

export interface SMSModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  showCloseButton?: boolean;
  size?: 'small' | 'medium' | 'large' | 'sm' | 'md' | 'lg' | 'lg-xl' | 'xl';
  className?: string;
  overlayClassName?: string;
  headerActions?: React.ReactNode;
  /** Applied to the dialog content wrapper (below the title). */
  contentClassName?: string;
  /** When true, dialog paper will not scroll; children must manage their own scrolling. */
  disablePaperScroll?: boolean;
}

/** Between MUI `lg` (1200px) and `xl` (1536px). */
const LG_XL_MAX_WIDTH_PX = 1100;

export const SMSModal: React.FC<SMSModalProps> = ({
  open,
  isOpen,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  showCloseButton = true,
  size,
  className,
  overlayClassName,
  headerActions,
  contentClassName,
  disablePaperScroll = false,
}) => {
  const resolvedOpen = open ?? isOpen ?? false;

  const getMaxWidth = () => {
    if (size) {
      switch (size) {
        case 'sm':
        case 'small':
          return 'xs';
        case 'md':
        case 'medium':
          return 'md'; // Changed from 'sm' to 'md' for better form sizing
        case 'xl':
          return 'xl';
        case 'lg-xl':
          return false;
        case 'lg':
        case 'large':
          return 'lg';
        default:
          return maxWidth;
      }
    }
    return maxWidth;
  };

  const customPaperMaxWidth = size === 'lg-xl' ? LG_XL_MAX_WIDTH_PX : undefined;

  return (
    <SMSDialog
      open={resolvedOpen}
      onClose={onClose}
      maxWidth={getMaxWidth()}
      fullWidth={fullWidth}
      BackdropProps={overlayClassName ? { className: overlayClassName } : undefined}
      PaperProps={{
        className,
        sx: {
          borderRadius: 'var(--radius-md)',
          maxHeight: '90vh',
          overflowY: disablePaperScroll ? 'hidden' : 'auto',
          overflowX: 'visible',
          ...(customPaperMaxWidth != null && {
            maxWidth: customPaperMaxWidth,
            width: '100%',
          }),
        },
      }}
    >
      {(title || showCloseButton) && (
        <SMSStandardDialogHeader
          title={title}
          onClose={onClose}
          showCloseButton={showCloseButton}
          headerActions={headerActions}
        />
      )}
      <SMSDialogContent className={contentClassName}>{children}</SMSDialogContent>
      {actions && <SMSDialogActions>{actions}</SMSDialogActions>}
    </SMSDialog>
  );
};

export default SMSModal;

