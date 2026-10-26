import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { SMSBox, SMSDropdown, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import { PostPositionStatus } from '@/types/postPosition';
import { POST_POSITION, ROSTER_WAITING_JOB_POSITION_MODAL } from '@/constants/strings';
import type { RosterInformation } from '@/types/roster';
import type { SMSRosterEditableUnitConfig } from './smsRosterTypes';
import './SMSRosterTable.css';

export interface SMSRosterTableProps {
  rows: RosterInformation[];
  onCancellationPendingClick?: (row: RosterInformation) => void;
  showWaitingListIndicator?: boolean;
  /** When set, Unit column shows hover edit/delete actions for call sign updates. */
  editableUnit?: SMSRosterEditableUnitConfig;
  /** Pixels from scroll container top where thead cells stick (height of sticky section title block above the table). */
  stickyHeaderTopPx?: number;
}

const headerCellSx = {
  fontWeight: 700,
  fontSize: '13px',
  backgroundColor: '#f3f3f3',
  padding: '6px 10px',
  border: '1px solid #cfcfcf',
  lineHeight: 1.2,
  whiteSpace: 'nowrap' as const,
};

const bodyCellSx = {
  fontSize: '13px',
  padding: '6px 10px',
  border: '1px solid #e0e0e0',
  lineHeight: 1.2,
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 0,
};

export const SMSRosterTable: React.FC<SMSRosterTableProps> = ({
  rows,
  onCancellationPendingClick,
  showWaitingListIndicator = true,
  editableUnit,
  stickyHeaderTopPx,
}) => {
  if (!rows || rows.length === 0) return null;

  const stickyTheadSx =
    stickyHeaderTopPx != null
      ? {
          position: 'sticky' as const,
          top: stickyHeaderTopPx,
          zIndex: 3,
          boxShadow: '0 2px 3px -1px rgba(0, 0, 0, 0.08)',
        }
      : {};

  /** Stable row key when postPositionId exists; otherwise index-based key is used. */
  const getRowKeyId = (row: RosterInformation): string | undefined => {
    const id = row.postPositionID?.trim();
    return id || undefined;
  };

  /** Call sign API requires postPositionID; do not offer unit edit without it. */
  const getPostPositionIdForUnitEdit = (row: RosterInformation): string =>
    row.postPositionID?.trim() ?? '';

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      className="tableContainer"
      sx={{ overflow: 'visible' }}
    >
      <Table
        size="small"
        sx={{
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          width: '100%',
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell align="center" sx={{ ...headerCellSx, ...stickyTheadSx, width: '18%' }}>
              Unit
            </TableCell>
            <TableCell align="center" sx={{ ...headerCellSx, ...stickyTheadSx, width: '22%' }}>
              Officer
            </TableCell>
            <TableCell align="center" sx={{ ...headerCellSx, ...stickyTheadSx, width: '12%' }}>
              Payroll
            </TableCell>
            <TableCell align="center" sx={{ ...headerCellSx, ...stickyTheadSx, width: '15%' }}>
              Vehicle
            </TableCell>
            <TableCell align="center" sx={{ ...headerCellSx, ...stickyTheadSx, width: '33%' }}>
              Assignment
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, idx) => {
            const isFirstRowSupervisor = idx === 0 && row.isSupervisorPost === true;
            const cellSx = isFirstRowSupervisor ? { ...bodyCellSx, fontWeight: 700 } : bodyCellSx;
            const rowKeyId = getRowKeyId(row);
            const postPositionIdForUnitEdit = getPostPositionIdForUnitEdit(row);
            const showUnitActionIcons =
              !!editableUnit &&
              !!postPositionIdForUnitEdit &&
              editableUnit.editingPostPositionId !== postPositionIdForUnitEdit;
            const showUnitDeleteIcon = showUnitActionIcons && Boolean(row.callUnit?.trim());

            return (
              <TableRow
                key={rowKeyId ?? `roster-row-${idx}`}
                sx={{
                  height: 34,
                  ...(idx % 2 === 1 ? { backgroundColor: '#fafafa' } : { backgroundColor: '#fff' }),
                  ...(showUnitActionIcons
                    ? {
                        '& .sms-roster-unit-actions': {
                          opacity: 0,
                          pointerEvents: 'none',
                          transition: 'opacity 0.15s ease',
                        },
                        '&:hover .sms-roster-unit-actions, &:focus-within .sms-roster-unit-actions': {
                          opacity: 1,
                          pointerEvents: 'auto',
                        },
                      }
                    : {}),
                }}
              >
                <TableCell
                  align="center"
                  sx={{
                    ...cellSx,
                    width: '18%',
                    ...(editableUnit && postPositionIdForUnitEdit
                      ? {
                          cursor: editableUnit.isSaving ? 'wait' : 'default',
                          verticalAlign: 'middle',
                        }
                      : {}),
                  }}
                >
                  {!editableUnit ? (
                    row.callUnit || '-'
                  ) : editableUnit.editingPostPositionId === postPositionIdForUnitEdit &&
                    postPositionIdForUnitEdit ? (
                    <SMSDropdown
                      size="small"
                      value={editableUnit.editingValue}
                      options={editableUnit.callSignOptions}
                      onChange={(e) => editableUnit.onEditingChange(String(e.target.value))}
                      onClose={() => editableUnit.onEditingClose()}
                      onKeyDown={(e) => editableUnit.onEditingKeyDown(e)}
                      disabled={editableUnit.isSaving || editableUnit.isLoadingCallSignOptions}
                      searchable={false}
                      clearable
                      autoFocus
                      fullWidth
                      sx={{ minWidth: 72, marginTop: 0 }}
                      aria-label={POST_POSITION.CALL_SIGN.EDIT_ARIA_LABEL}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <SMSBox
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 0.5,
                        flexWrap: 'nowrap',
                        minWidth: 0,
                        width: '100%',
                      }}
                    >
                      <SMSBox
                        component="span"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0,
                          flex: 1,
                          textAlign: 'left',
                        }}
                        title={row.callUnit || '-'}
                      >
                        {row.callUnit || '-'}
                      </SMSBox>
                      {showUnitActionIcons && (
                        <SMSBox
                          className="sms-roster-unit-actions"
                          sx={{ display: 'inline-flex', gap: 0.25, flexShrink: 0, alignItems: 'center' }}
                        >
                          <SMSIconButton
                            tone="primary"
                            variant="plain"
                            size="small"
                            aria-label={POST_POSITION.CALL_SIGN.EDIT_BUTTON_ARIA_LABEL}
                            title={POST_POSITION.CALL_SIGN.EDIT_BUTTON_ARIA_LABEL}
                            tabIndex={editableUnit.isSaving ? -1 : 0}
                            disabled={editableUnit.isSaving}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (editableUnit.isSaving) return;
                              editableUnit.onEditPress(row);
                            }}
                            onKeyDown={(e) => {
                              if (editableUnit.isSaving) return;
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                editableUnit.onEditPress(row);
                              }
                            }}
                            sx={{
                              transform: 'scale(0.78)',
                              transformOrigin: 'center',
                            }}
                          >
                            <SMSIcon name="edit" size="sm" color="#1565c0" />
                          </SMSIconButton>
                          {showUnitDeleteIcon && (
                            <SMSIconButton
                              tone="error"
                              variant="plain"
                              size="small"
                              aria-label={POST_POSITION.CALL_SIGN.DELETE_BUTTON_ARIA_LABEL}
                              title={POST_POSITION.CALL_SIGN.DELETE_BUTTON_ARIA_LABEL}
                              tabIndex={editableUnit.isSaving ? -1 : 0}
                              disabled={editableUnit.isSaving}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (editableUnit.isSaving) return;
                                editableUnit.onDeletePress(row);
                              }}
                              onKeyDown={(e) => {
                                if (editableUnit.isSaving) return;
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  editableUnit.onDeletePress(row);
                                }
                              }}
                              sx={{
                                transform: 'scale(0.78)',
                                transformOrigin: 'center',
                              }}
                            >
                              <SMSIcon name="delete" size="sm" color="#c62828" />
                            </SMSIconButton>
                          )}
                        </SMSBox>
                      )}
                    </SMSBox>
                  )}
                </TableCell>
                <TableCell align="center" sx={{ ...cellSx, width: '22%' }}>
                  <SMSBox sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    <SMSBox
                      component="span"
                      sx={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row.employeeName || '-'}
                    >
                      {row.employeeName || '-'}
                    </SMSBox>
                    {showWaitingListIndicator &&
                      row.postPositionStatus === PostPositionStatus.CancellationPending && (
                        <SMSBox
                          component="span"
                          className="roster-waiting-icon"
                          role="button"
                          tabIndex={0}
                          aria-label="Cancellation Pending"
                          title={ROSTER_WAITING_JOB_POSITION_MODAL.VIEW_WAITING_INFO_ARIA}
                          onClick={() => onCancellationPendingClick?.(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onCancellationPendingClick?.(row);
                            }
                          }}
                          sx={{ display: 'inline-flex', cursor: 'pointer', p: 0.25 }}
                        >
                          <SMSIcon name="hourglass_top" size="sm" />
                        </SMSBox>
                      )}
                  </SMSBox>
                </TableCell>
                <TableCell align="center" sx={{ ...cellSx, width: '12%' }}>{row.employeeNumber || '-'}</TableCell>
                <TableCell
                  align="center"
                  sx={{
                    ...cellSx,
                    width: '15%',
                    whiteSpace: 'normal',
                    overflow: 'visible',
                    textOverflow: 'clip',
                    maxWidth: 'none',
                    wordBreak: 'break-word',
                  }}
                  title={row.vehicleName || '-'}
                >
                  {row.vehicleName || '-'}
                </TableCell>
                <TableCell align="center" sx={{ ...cellSx, width: '33%' }}>{row.postLocation || '-'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
