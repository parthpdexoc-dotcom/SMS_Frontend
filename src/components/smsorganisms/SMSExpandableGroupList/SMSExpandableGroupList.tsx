import React, { useCallback } from 'react';
import { Collapse, Divider, Stack, Typography } from '@mui/material';
import {
  SMSBox,
  SMSCard,
  SMSChip,
  SMSIcon,
  SMSIconButton,
} from '@/components/smsatoms';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms/SMSDataTableWrapper/SMSDataTableWrapper';
import './SMSExpandableGroupList.css';

/** A single label/value cell rendered inside a group's header meta grid. */
export interface SMSExpandableGroupHeaderCell {
  /** Small caption shown above the value (e.g. "Date Of Work"). */
  label: string;
  /** Value (string, number, or any node) shown below the label. */
  value: React.ReactNode;
  /** Optional `title` attribute for the value (defaults to its string form). */
  title?: string;
  /** Stable key when more than one cell shares a label. */
  key?: string;
}

/** Strings used for accessibility labels on the chevron toggle. */
export interface SMSExpandableGroupListLabels {
  expand?: string;
  collapse?: string;
}

export interface SMSExpandableGroupListProps<G, R extends Record<string, unknown>> {
  /** Items to render. */
  groups: G[];

  /** Stable identity for React keys. */
  getGroupKey: (group: G) => string;

  /** Stable identity used to look up `expandedKeys`. */
  getExpandKey: (group: G) => string;

  /** Currently expanded keys (controlled). */
  expandedKeys: Set<string>;

  /** Toggle handler — caller updates `expandedKeys`. */
  onToggleGroup: (group: G) => void;

  /** Header: primary heading text (e.g., requester name). */
  getPrimaryText: (group: G) => string;

  /** Header: structured label/value cells rendered to the right of the primary text. */
  getHeaderCells?: (group: G) => SMSExpandableGroupHeaderCell[];

  /** Optional count chip rendered at the end of the header (e.g., "3 posts"). */
  getCountChipLabel?: (group: G) => string;

  /** Nested grid: rows for a group. */
  getRows: (group: G) => R[];

  /** Nested grid: column definitions (group-aware). */
  getRowColumns: (group: G) => DataTableColumn<R>[];

  /** Nested grid: stable row key. */
  getRowKey: (row: R) => string | number;

  /** Empty message for the nested grid when a group has no rows. */
  nestedEmptyMessage?: string;

  /** Max height for the nested table body — defaults to `min(38vh, 320px)`. */
  nestedMaxBodyHeight?: number | string;

  /**
   * Optional override for the desktop (>=900px) meta-grid `grid-template-columns`.
   * Typically used to fix specific track widths (e.g. `"35% 12% 12% 12% 29%"`).
   */
  metaGridTemplateColumns?: string;

  /** Aria labels on the chevron toggle. */
  labels?: SMSExpandableGroupListLabels;

  /** Class for the outer container. */
  className?: string;
}

const DEFAULT_LABELS: Required<SMSExpandableGroupListLabels> = {
  expand: 'Expand row',
  collapse: 'Collapse row',
};

/** Inner table body scroll cap (slightly below panel cap to allow panel padding). */
const DEFAULT_NESTED_MAX_BODY_HEIGHT = 'min(38vh, 320px)';

/**
 * Generic "expandable rows with a nested grid" pattern.
 *
 * Each group renders a card-like header (chevron + primary text + optional
 * meta cells + optional count chip). Expanding a row reveals an embedded
 * `SMSDataTableWrapper`. Expansion state is controlled by the caller so it
 * can be wired to URL params, local state, etc.
 */
export function SMSExpandableGroupList<G, R extends Record<string, unknown>>(
  props: SMSExpandableGroupListProps<G, R>
): React.ReactElement {
  const {
    groups,
    getGroupKey,
    getExpandKey,
    expandedKeys,
    onToggleGroup,
    getPrimaryText,
    getHeaderCells,
    getCountChipLabel,
    getRows,
    getRowColumns,
    getRowKey,
    nestedEmptyMessage,
    nestedMaxBodyHeight = DEFAULT_NESTED_MAX_BODY_HEIGHT,
    metaGridTemplateColumns,
    labels,
    className,
  } = props;

  const expandLabel = labels?.expand ?? DEFAULT_LABELS.expand;
  const collapseLabel = labels?.collapse ?? DEFAULT_LABELS.collapse;

  const handleToggle = useCallback(
    (group: G) => () => onToggleGroup(group),
    [onToggleGroup]
  );

  const rootClassName = ['sms-expandable-group-list', className]
    .filter(Boolean)
    .join(' ');

  const rootStyle = metaGridTemplateColumns
    ? ({ ['--sms-egl-meta-cols' as string]: metaGridTemplateColumns } as React.CSSProperties)
    : undefined;

  return (
    <SMSBox className={rootClassName} style={rootStyle}>
      {groups.map((group) => {
        const key = getGroupKey(group);
        const expandKey = getExpandKey(group);
        const isExpanded = expandedKeys.has(expandKey);
        const primaryText = getPrimaryText(group);
        const cells = getHeaderCells?.(group) ?? [];
        const chipLabel = getCountChipLabel?.(group);
        const rows = getRows(group);
        const columns = getRowColumns(group);

        return (
          <SMSBox
            key={key}
            className="sms-expandable-group-list__row"
            data-expanded={isExpanded ? 'true' : 'false'}
          >
            <SMSBox className="sms-expandable-group-list__header">
              <SMSBox className="sms-expandable-group-list__header-main">
                <SMSIconButton
                  type="button"
                  size="small"
                  variant="plain"
                  tone="primary"
                  allowWhenSuspended
                  className="sms-expandable-group-list__expand-btn"
                  onClick={handleToggle(group)}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? collapseLabel : expandLabel}
                >
                  <SMSIcon
                    name="arrowRight"
                    size="sm"
                    className="sms-expandable-group-list__expand-icon"
                  />
                </SMSIconButton>
                <SMSBox className="sms-expandable-group-list__identity">
                  <SMSBox className="sms-expandable-group-list__meta">
                    <span
                      className="sms-expandable-group-list__primary sms-expandable-group-list__cell"
                      title={primaryText || undefined}
                    >
                      {primaryText}
                    </span>
                    {cells.map((cell, idx) => {
                      const cellKey = cell.key ?? `${cell.label}-${idx}`;
                      const valueTitle =
                        cell.title ??
                        (typeof cell.value === 'string' || typeof cell.value === 'number'
                          ? String(cell.value)
                          : undefined);
                      return (
                        <Stack
                          key={cellKey}
                          direction="column"
                          alignItems="flex-start"
                          className="sms-expandable-group-list__cell-stack sms-expandable-group-list__cell"
                          sx={{ width: '100%', minWidth: 0 }}
                        >
                          <Typography
                            component="span"
                            variant="body1"
                            color="text.secondary"
                            className="sms-expandable-group-list__cell-label sms-expandable-group-list__ellipsis"
                            title={cell.label}
                          >
                            {cell.label}
                          </Typography>
                          <Typography
                            variant="body1"
                            color="text.secondary"
                            component="span"
                            className="sms-expandable-group-list__cell-value sms-expandable-group-list__ellipsis"
                            title={valueTitle}
                          >
                            {cell.value}
                          </Typography>
                        </Stack>
                      );
                    })}
                  </SMSBox>
                </SMSBox>
                {chipLabel ? (
                  <SMSChip
                    size="small"
                    label={chipLabel}
                    color="primary"
                    variant="outlined"
                    className="sms-expandable-group-list__count-chip"
                  />
                ) : null}
              </SMSBox>
            </SMSBox>

            <Collapse
              in={isExpanded}
              timeout={{ enter: 200, exit: 180 }}
              unmountOnExit
              className="sms-expandable-group-list__collapse"
              sx={{
                width: '100%',
                alignSelf: 'stretch',
                '& .MuiCollapse-wrapperInner': {
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                },
              }}
            >
              <div className="sms-expandable-group-list__collapse-region">
                <Divider className="sms-expandable-group-list__seam" />
                <SMSBox className="sms-expandable-group-list__panel">
                  <SMSCard
                    variant="outlined"
                    elevation={0}
                    className="sms-expandable-group-list__panel-card"
                    padding="none"
                    sx={{
                      borderRadius: 1,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                      flex: 'none',
                    }}
                  >
                    <SMSBox
                      className="sms-expandable-group-list__panel-scroll"
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                        flex: 'none',
                      }}
                    >
                      <SMSDataTableWrapper<R>
                        columns={columns}
                        data={rows}
                        loading={false}
                        error={null}
                        emptyMessage={nestedEmptyMessage}
                        searchable={false}
                        responsiveMode="table"
                        maxBodyHeight={nestedMaxBodyHeight}
                        getRowKey={getRowKey}
                        tableClassName="sms-expandable-group-list__data-table"
                        embedded
                      />
                    </SMSBox>
                  </SMSCard>
                </SMSBox>
              </div>
            </Collapse>
          </SMSBox>
        );
      })}
    </SMSBox>
  );
}

export default SMSExpandableGroupList;
