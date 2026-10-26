import React, { useLayoutEffect, useRef, useState } from 'react';
import { Typography, Box } from '@mui/material';
import { SMSRosterTable } from './SMSRosterTable';
import type { RosterInformation, RosterTable } from '@/types/roster';
import type { SMSRosterEditableUnitConfig } from './smsRosterTypes';
import './SMSRosterSection.css';

export interface SMSRosterSectionProps {
  table: RosterTable;
  onCancellationPendingClick?: (row: RosterInformation) => void;
  showWaitingListIndicator?: boolean;
  editableUnit?: SMSRosterEditableUnitConfig;
  /** When true, section title + meta stay sticky; column headers stick below them while scrolling. */
  stickySectionHeaders?: boolean;
}

export const SMSRosterSection: React.FC<SMSRosterSectionProps> = ({
  table,
  onCancellationPendingClick,
  showWaitingListIndicator = true,
  editableUnit,
  stickySectionHeaders = true,
}) => {
  const postDescription = (table.postDescription ?? '').trim();
  const payCodeValue = (table.payCodeValue ?? '').trim();
  const sectionHeadRef = useRef<HTMLDivElement>(null);
  const [sectionHeadHeightPx, setSectionHeadHeightPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!stickySectionHeaders) {
      setSectionHeadHeightPx(null);
      return;
    }
    const el = sectionHeadRef.current;
    if (!el) return;

    const measure = () => {
      setSectionHeadHeightPx(Math.ceil(el.getBoundingClientRect().height));
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stickySectionHeaders, table.postTitle, postDescription, payCodeValue, table.rows]);

  return (
    <Box className="section">
      <Box
        ref={sectionHeadRef}
        className={stickySectionHeaders ? 'sms-roster-section-sticky-head' : undefined}
        sx={
          stickySectionHeaders
            ? {
                position: 'sticky',
                top: 0,
                zIndex: 4,
                bgcolor: '#ffffff',
                borderBottom: '1px solid #e8e8e8',
              }
            : undefined
        }
      >
        <Typography
          align="center"
          sx={{
            fontSize: 18,
            fontWeight: 600,
            mt: 2,
            mb: 0.5,
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            textDecorationThickness: '1.5px',
            textTransform: 'none',
          }}
        >
          {table.postTitle}
        </Typography>

        {(postDescription || payCodeValue) && (
          <Box
            className="roster-meta-row"
            sx={{
              justifyContent:
                postDescription && payCodeValue
                  ? 'space-between'
                  : payCodeValue
                    ? 'flex-end'
                    : 'flex-start',
            }}
          >
            {postDescription && (
              <Typography variant="body2" className="roster-meta-row__description">
                {postDescription}
              </Typography>
            )}
            {payCodeValue && (
              <Typography variant="body2" className="roster-paycode">
                {payCodeValue}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      <SMSRosterTable
        rows={table.rows}
        onCancellationPendingClick={onCancellationPendingClick}
        showWaitingListIndicator={showWaitingListIndicator}
        editableUnit={editableUnit}
        stickyHeaderTopPx={stickySectionHeaders && sectionHeadHeightPx !== null ? sectionHeadHeightPx : undefined}
      />
    </Box>
  );
};
