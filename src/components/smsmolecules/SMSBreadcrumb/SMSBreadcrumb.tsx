import React from 'react';
import { SMSStack, SMSTypography, SMSButton, SMSIcon } from '@/components/smsatoms';

export interface SMSBreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: string;
}

export interface SMSBreadcrumbProps {
  items: SMSBreadcrumbItem[];
  separator?: string | React.ReactNode;
  maxItems?: number;
}

export const SMSBreadcrumb: React.FC<SMSBreadcrumbProps> = ({
  items,
  separator = '/',
  maxItems,
}) => {
  // TODO: Implement breadcrumb navigation with ellipsis for long paths
  const displayItems = maxItems && items.length > maxItems
    ? [...items.slice(0, 1), { label: '...', href: undefined }, ...items.slice(-maxItems + 1)]
    : items;

  return (
    <SMSStack direction="row" spacing={1} alignItems="center">
      {displayItems.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <SMSTypography variant="body2" color="text.secondary">
              {separator}
            </SMSTypography>
          )}
          {item.href || item.onClick ? (
            <SMSButton
              variant="text"
              onClick={item.onClick}
              href={item.href}
              startIcon={item.icon ? <SMSIcon name={item.icon} size="sm" /> : undefined}
            >
              {item.label}
            </SMSButton>
          ) : (
            <SMSStack direction="row" spacing={0.5} alignItems="center">
              {item.icon && <SMSIcon name={item.icon} size="sm" />}
              <SMSTypography variant="body2" color={index === displayItems.length - 1 ? 'text.primary' : 'text.secondary'}>
                {item.label}
              </SMSTypography>
            </SMSStack>
          )}
        </React.Fragment>
      ))}
    </SMSStack>
  );
};

export default SMSBreadcrumb;

