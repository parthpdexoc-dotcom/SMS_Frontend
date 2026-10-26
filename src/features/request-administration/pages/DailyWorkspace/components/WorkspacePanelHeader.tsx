import React from 'react';
import { SMSBox } from '@/components/smsatoms';
import { DAILY_WORKSPACE } from '@/constants/strings';

export interface WorkspacePanelHeaderProps {
  title: string;
  count: number;
  subtitle?: string;
  collapsed: boolean;
  collapsible?: boolean;
  onToggleCollapse: () => void;
  tools?: React.ReactNode;
}

export const WorkspacePanelHeader: React.FC<WorkspacePanelHeaderProps> = ({
  title,
  count,
  subtitle,
  collapsed,
  collapsible = true,
  onToggleCollapse,
  tools,
}) => (
  <SMSBox
    className={`daily-workspace__panel-header${collapsed ? ' is-collapsed' : ''}`}
    onClick={collapsed ? onToggleCollapse : undefined}
  >
    <SMSBox className="daily-workspace__panel-header-main">
      {collapsible ? (
        <button
          type="button"
          className="daily-workspace__panel-collapse-btn"
          title={collapsed ? DAILY_WORKSPACE.EXPAND_SECTION : DAILY_WORKSPACE.COLLAPSE_SECTION}
          aria-label={collapsed ? DAILY_WORKSPACE.EXPAND_SECTION : DAILY_WORKSPACE.COLLAPSE_SECTION}
          aria-expanded={!collapsed}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
        >
          {collapsed ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 8H2m0 0l2-2M2 8l2 2M10 8h4m0 0l-2-2m2 2l-2 2" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 8h4m0 0L4 6m2 2L4 10M14 8h-4m0 0l2-2m-2 2l2 2" />
            </svg>
          )}
        </button>
      ) : (
        <span className="daily-workspace__panel-collapse-spacer" aria-hidden="true" />
      )}
      <SMSBox className="daily-workspace__panel-heading">
        <SMSBox className="daily-workspace__panel-title-row">
          <h2 className="daily-workspace__panel-title">
            <span className="daily-workspace__panel-title-text">{title}</span>
            <span className="daily-workspace__panel-count" aria-label={`${count}`}>
              {count}
            </span>
          </h2>
        </SMSBox>
        {subtitle && !collapsed && <p className="daily-workspace__panel-sub">{subtitle}</p>}
      </SMSBox>
    </SMSBox>
    {!collapsed && tools ? <SMSBox className="daily-workspace__panel-tools">{tools}</SMSBox> : null}
  </SMSBox>
);
