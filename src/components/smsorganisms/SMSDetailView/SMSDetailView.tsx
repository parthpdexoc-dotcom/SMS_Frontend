import React from 'react';
import { SMSPageLayout } from '../SMSPageLayout';
import { SMSStack, SMSTypography, SMSCard, SMSGrid } from '@/components/smsatoms';
import { SMSBreadcrumb, SMSActionBar, SMSDataDisplay } from '@/components/smsmolecules';
import { SMSBreadcrumbItem } from '@/components/smsmolecules';
import { SMSActionBarAction } from '@/components/smsmolecules';

export interface SMSDetailViewSection {
  title?: string;
  fields: Array<{
    label: string;
    value: React.ReactNode;
    icon?: string;
    span?: number;
  }>;
}

export interface SMSDetailViewProps {
  title: string;
  breadcrumbs?: SMSBreadcrumbItem[];
  actions?: SMSActionBarAction[];
  sections: SMSDetailViewSection[];
  loading?: boolean;
}

export const SMSDetailView: React.FC<SMSDetailViewProps> = ({
  title,
  breadcrumbs,
  actions,
  sections,
}) => {
  // TODO: Implement detail view component with sections and action bar
  return (
    <SMSPageLayout>
      <SMSStack spacing={3}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <SMSBreadcrumb items={breadcrumbs} />
        )}
        <SMSStack direction="row" justifyContent="space-between" alignItems="center">
          <SMSTypography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            {title}
          </SMSTypography>
          {actions && actions.length > 0 && <SMSActionBar actions={actions} />}
        </SMSStack>
        {sections.map((section, sectionIndex) => (
          <SMSCard key={sectionIndex} sx={{ padding: 3 }}>
            <SMSStack spacing={3}>
              {section.title && (
                <SMSTypography variant="h6" sx={{ fontWeight: 600 }}>
                  {section.title}
                </SMSTypography>
              )}
              <SMSGrid container spacing={3}>
                {section.fields.map((field, fieldIndex) => (
                  <SMSGrid item xs={12} sm={field.span || 6} key={fieldIndex}>
                    <SMSDataDisplay
                      label={field.label}
                      value={field.value}
                      icon={field.icon}
                      variant="default"
                    />
                  </SMSGrid>
                ))}
              </SMSGrid>
            </SMSStack>
          </SMSCard>
        ))}
      </SMSStack>
    </SMSPageLayout>
  );
};

export default SMSDetailView;

