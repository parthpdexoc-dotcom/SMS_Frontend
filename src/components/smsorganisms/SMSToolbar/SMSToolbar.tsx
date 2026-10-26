import React from 'react';
import { SMSStack, SMSTypography, SMSBox } from '@/components/smsatoms';
import { SMSActionBar } from '@/components/smsmolecules';
import { SMSActionBarAction } from '@/components/smsmolecules';

export interface SMSToolbarProps {
  title?: string;
  subtitle?: string;
  actions?: SMSActionBarAction[];
  leftActions?: SMSActionBarAction[];
  rightActions?: SMSActionBarAction[];
  position?: 'top' | 'bottom';
  variant?: 'default' | 'elevated' | 'outlined';
}

export const SMSToolbar: React.FC<SMSToolbarProps> = ({
  title,
  subtitle,
  actions,
  leftActions,
  rightActions,
  position = 'top',
  variant = 'default',
}) => {
  // TODO: Implement toolbar component with flexible action positioning
  const displayActions = actions || [];
  const displayLeftActions = leftActions || [];
  const displayRightActions = rightActions || [];

  const borderKey = position === 'bottom' ? 'borderTop' : 'borderBottom';
  return (
    <SMSBox
      sx={{
        padding: 2,
        [borderKey]: variant === 'outlined' ? '1px solid' : 'none',
        boxShadow: variant === 'elevated' ? 2 : 'none',
        backgroundColor: 'background.paper',
      }}
    >
      <SMSStack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
        {(title || subtitle) && (
          <SMSStack spacing={0.5}>
            {title && (
              <SMSTypography variant="h6" sx={{ fontWeight: 600 }}>
                {title}
              </SMSTypography>
            )}
            {subtitle && (
              <SMSTypography variant="body2" color="text.secondary">
                {subtitle}
              </SMSTypography>
            )}
          </SMSStack>
        )}
        <SMSStack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, justifyContent: 'flex-end' }}>
          {displayLeftActions.length > 0 && <SMSActionBar actions={displayLeftActions} position="left" />}
          {displayActions.length > 0 && <SMSActionBar actions={displayActions} />}
          {displayRightActions.length > 0 && <SMSActionBar actions={displayRightActions} position="right" />}
        </SMSStack>
      </SMSStack>
    </SMSBox>
  );
};

export default SMSToolbar;

