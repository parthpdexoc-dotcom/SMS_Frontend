import { FC, memo } from 'react';
import { SMSCard } from '@/components/smsatoms';
import { cn } from '@/utils';
import type { BaseComponentProps } from '@/types';
import styles from './SMSChartCard.module.css';

export interface SMSChartCardProps extends BaseComponentProps {
  title: string;
}

export const SMSChartCard: FC<SMSChartCardProps> = memo(function SMSChartCard({
  title,
  children,
  className = '',
}) {
  return (
    <SMSCard
      className={cn(styles.root, className)}
      sx={{ p: 'var(--spacing-lg)' }}
    >
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.content}>{children}</div>
    </SMSCard>
  );
});

SMSChartCard.displayName = 'SMSChartCard';

export default SMSChartCard;
