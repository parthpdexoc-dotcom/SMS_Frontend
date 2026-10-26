import React, { FC, memo } from 'react';
import { SMSDialogTitle } from './SMSDialogTitle';
import { SMSStack } from '../SMSStack/SMSStack';
import { SMSTypography } from '../SMSTypography/SMSTypography';
import { SMSIcon } from '../SMSIcon/SMSIcon';
import { SMSIconButton } from '../SMSIconButton/SMSIconButton';

export interface SMSStandardDialogHeaderProps {
  title?: React.ReactNode;
  onClose: () => void;
  showCloseButton?: boolean;
  headerActions?: React.ReactNode;
}

const titleTypographySx = {
  fontSize: '1.5rem',
  fontWeight: 600,
  margin: 0,
  background: 'var(--gradient-primary)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
} as const;

const closeButtonSx = {
  minWidth: 32,
  width: 32,
  minHeight: 31,
  maxHeight: 31,
  height: 31,
  p: 0,
  borderRadius: 1,
  color: 'var(--text-inverse)',
  backgroundColor: 'var(--secondary-color, #d4af37)',
  '&:hover': {
    backgroundColor: 'var(--secondary-hover, #B8860B)',
    color: 'var(--text-inverse)',
  },
} as const;

export const SMSStandardDialogHeader: FC<SMSStandardDialogHeaderProps> = memo(
  ({ title, onClose, showCloseButton = true, headerActions }) => {
    if (!title && !showCloseButton) return null;

    return (
      <SMSDialogTitle
        sx={{
          mb: 1,
          paddingBottom: 1,
          borderBottom: '3px solid',
          borderColor: 'divider',
        }}
      >
        <SMSStack direction="row" justifyContent="space-between" alignItems="center">
          {title != null && title !== '' && (
            typeof title === 'string' ? (
              <SMSTypography variant="h5" sx={titleTypographySx}>
                {title}
              </SMSTypography>
            ) : (
              title
            )
          )}
          <SMSStack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
            {headerActions}
            {showCloseButton && (
              <SMSIconButton
                size="small"
                allowWhenSuspended
                onClick={onClose}
                aria-label="Close modal"
                sx={closeButtonSx}
              >
                <SMSIcon name="close" size="sm" />
              </SMSIconButton>
            )}
          </SMSStack>
        </SMSStack>
      </SMSDialogTitle>
    );
  },
);

SMSStandardDialogHeader.displayName = 'SMSStandardDialogHeader';

export default SMSStandardDialogHeader;
