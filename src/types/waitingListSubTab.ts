/** Sub-tabs under My Waiting List (IDs are stable for API/Redux; labels are in `WAITING_LIST.SUB_TABS`). */
export enum WaitingListSubTab {
  TenureBased = 'tenure-based',
  General = 'general',
}

export function isWaitingListSubTab(value: string): value is WaitingListSubTab {
  return (Object.values(WaitingListSubTab) as string[]).includes(value);
}
