import React from 'react';
import { SMSBox, SMSGrid, SMSStatisticCard } from '@/components/smsatoms';
import type { StatisticSlateProps } from '@/types/statisticSlate';
import { cn } from '@/utils';
import './StatisticSlate.css';

const DEFAULT_COLUMNS = { xs: 12, sm: 6, md: 3 };

/** Row of statistic cards — responsive MUI grid or custom CSS grid columns. */
export const StatisticSlate: React.FC<StatisticSlateProps> = ({
  items,
  className,
  gridTemplateColumns,
  columns,
  sx,
}) => {
  const gridCols = { ...DEFAULT_COLUMNS, ...columns };
  if (gridTemplateColumns) {
    return (
      <SMSBox
        className={cn('statistic-slate', className)}
        sx={{
          display: 'grid',
          gridTemplateColumns,
          gap: 1.5,
          alignItems: 'stretch',
          ...sx,
        }}
      >
        {items.map(({ key, ...card }) => (
          <SMSStatisticCard key={key} {...card} />
        ))}
      </SMSBox>
    );
  }

  return (
    <SMSGrid
      container
      spacing={1.5}
      className={cn('statistic-slate', className)}
      sx={sx}
    >
      {items.map(({ key, ...card }) => (
        <SMSGrid
          key={key}
          item
          xs={gridCols.xs}
          sm={gridCols.sm}
          md={gridCols.md}
          lg={gridCols.lg}
        >
          <SMSStatisticCard {...card} />
        </SMSGrid>
      ))}
    </SMSGrid>
  );
};
