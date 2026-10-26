---
name: scrum-961-dcr-records-displayed-per-page
branch: feature/scrum-961-default-rows-per-page-25
status: completed
priority: Medium
scope: Medium
epic: NA
created: 2026-08-03
issue: NA
jira: SCRUM-961
---

# DCR — Records Displayed Per Page (SCRUM-961)

## Problem/Goal

Agency (DCR) wants the **default rows per page** increased from **10** to **25** on every screen that exposes a “rows per page” control. Every such control must continue to offer **25** as a selectable option (along with the existing choices).

**Why this matters:** Supervisors and admins work with long lists (employees, jobs, requesters, audit logs, payments, etc.). Showing 10 rows by default forces extra paging; 25 matches agency preference and reduces clicks without removing smaller page sizes for users who want them.

Jira: [SCRUM-961](https://checkthesite.atlassian.net/browse/SCRUM-961) — *DCR - RECORDS DISPLAYED PER PAGE*.

---

## Success Criteria

- [x] Global default table page size is **25** (was 10) via shared constant `DEFAULT_TABLE_PAGE_SIZE`.
- [x] Shared page-size option list includes **25** everywhere a user-facing “rows per page” selector exists: `[5, 10, 25, 50, 100]` (single exported constant, no duplicated inline arrays).
- [x] All list/table pages that use `usePagination`, `SMSDataTableWrapper` + `SMSPagination`, or custom page-size menus load with **25** rows on first visit (unless a page has a documented, intentional exception).
- [x] Redux slice initial `pageSize` values used for paginated tables are **25** (not 10).
- [x] Service-layer default `pageSize` parameters used for **table fetch** calls default to **25** when omitted.
- [x] Custom pagination UIs (Daily Administration per-request posts table, Requester List daily view, Close/Unclosed Assignments, email recipient picker, etc.) default to **25** and expose **25** in their option menus.
- [x] Dropdown/catalog fetches that intentionally load large sets (`pageSize: 1000`, `10000`, calendar `1000`, etc.) are **unchanged** — not user “rows per page” controls.
- [x] Lint/typecheck pass for touched files; no new diagnostics introduced.

---

## Context Manifest

### Related Work

- Jira: [SCRUM-961](https://checkthesite.atlassian.net/browse/SCRUM-961) — *DCR - RECORDS DISPLAYED PER PAGE*
- GitHub issue: NA (offer create after plan approval)

### Technical Context

**Central pagination today**

| Location | Current behavior |
|---|---|
| `src/constants/tablePagination.ts` | `DEFAULT_TABLE_PAGE_SIZE = 10` |
| `src/hooks/usePagination.ts` | Defaults to `DEFAULT_TABLE_PAGE_SIZE` |
| `src/components/smsatoms/SMSPagination/SMSPagination.tsx` | Options `[5, 10, 25, 50, 100]`; fallback math uses `10` when size invalid |
| `src/components/smsorganisms/SMSDataTableWrapper/SMSDataTableWrapper.tsx` | Renders `SMSPagination` without overriding options (inherits defaults) |

**25 is already in the dropdown** — the main gap is the **default selected value (10)** and **scattered hardcoded `10`** outside the shared constant.

**Hardcoded `10` defaults to update (audit with ripgrep before/after)**

- **Constant / hook:** `tablePagination.ts`, `usePagination.ts`, `SMSPagination` fallback
- **Redux initial state:** `employeeSlice`, `requestSlice`, `requesterSlice`, `requesterManagerSlice`, `requesterEmployeeSlice`, `requesterAuthorizedSlice`, `requesterRestrictedSlice`, `departmentAdminSlice`, `departmentDefinedFieldsSlice`, `blockDateSlice`, `tenureWaitingPositionSlice`, `postPositionSlice` (`closeAssignmentsPagination`, `paginationByStatus` defaults), `dailyWorkspaceSlice` (`PAGE_SIZE`)
- **Page-level `initialPageSize: 10` / local `DEFAULT_PAGE_SIZE = 10`:** Department admin lists (PayCode, Skills, Equipment, AdminType, HolidayDay, RoutingGroup, BusinessType, EmployeeStatus, EmployeeType, DepartmentEquipment, DepartmentDivision, DepartmentActivityType, DepartmentFee, PaymentType, FormTemplates, EmailTemplates), EmployeeList, RequesterPaymentPage (multiple paginations), PaymentList, reports (OfficerWorking, ArchivedReports, WatchCommander), CloseAssignments, UnclosedAssignments, SMSMasterDataShortLongStatusList, SMSFailedTransactionsList, EmployeeFormPage initial fetch, InvoiceList callback default, etc.
- **Other named constants:** `REQUESTER_EMPLOYEE.DEFAULT_PAGE_SIZE` in `strings.ts`, `EMAIL_TO_PICKER_PAGE_SIZE` in `emailUtils.ts`, `DAILY_REQUESTERS_PAGE_SIZE` in `RequesterList.tsx`, `availablePostService` `pageSize ?? 10`
- **Service defaults:** `paymentService.ts`, `refundPaymentService.ts`, `refundPaymentAllocationService.ts`, `requesterLedgerService.ts` (`pageSize = 10` params)

**Custom page-size UI (must keep 25 in options + default 25)**

- `DailyAdministration.tsx` — inline `[5, 10, 25, 50, 100]` Menu (replace with shared constant)
- `RequesterList.tsx` — `postsPagination` map defaults `{ page: 1, pageSize: 10 }`, `DAILY_REQUESTERS_PAGE_SIZE = 10`

**Explicitly out of scope (do not change)**

- Bulk dropdown loads: `pageSize: 1000`, `10000`, `500`, etc. for select lists / “fetch all for filter”
- `SCHEDULED_JOB_CALENDAR_PAGE_SIZE = 1000`
- `REQUESTER_MANAGER.DEFAULT_PAGE_SIZE: 100` (already 100; confirm intent before changing)
- Internal API chunk sizes (`postEquipmentService`, `requestEquipmentService` loop with `100`)

### Decisions Made

- [2026-08-03] Plan-first per `.github/copilot-instructions.md`; no coding until plan is approved.
- [2026-08-03] Standard option set remains **`[5, 10, 25, 50, 100]`** — ticket asks for 25 as default and as an option, not to remove 5/10/50/100.
- [2026-08-03] Prefer **one shared export** for both default size and options to prevent drift.

### References

- Plan workflow: `.github/instructions/plan-files.instructions.md`, `plan-files/TEMPLATE.md`
- Primary UI atom: `src/components/smsatoms/SMSPagination/SMSPagination.tsx`
- Shared table wrapper: `src/components/smsorganisms/SMSDataTableWrapper/SMSDataTableWrapper.tsx`

---

## User Notes

- Ticket title: **DCR - RECORDS DISPLAYED PER PAGE**
- Requirement: default **10 → 25**; **25** must appear on all rows-per-page selectors application-wide.
- Reference attachment in Jira (screenshot) — use during QA to spot any missed screens.

---

## Implementation Approach

### Phase 1 — Centralize constants

1. Update `src/constants/tablePagination.ts`:
   ```ts
   export const DEFAULT_TABLE_PAGE_SIZE = 25;
   export const TABLE_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;
   ```
2. `SMSPagination.tsx`: import `TABLE_PAGE_SIZE_OPTIONS` and `DEFAULT_TABLE_PAGE_SIZE`; replace local `DEFAULT_PAGE_SIZE_OPTIONS`; use `DEFAULT_TABLE_PAGE_SIZE` for invalid/missing `pageSize` fallback (replace hardcoded `10`).
3. `DailyAdministration.tsx`: replace inline `[5, 10, 25, 50, 100]` with `TABLE_PAGE_SIZE_OPTIONS`.

### Phase 2 — Default size = 25 everywhere tables paginate

1. **Redux slices:** change initial `pageSize: 10` → `DEFAULT_TABLE_PAGE_SIZE` (import constant) in all paginated list slices listed above.
2. **Pages using `usePagination({ initialPageSize: 10 })`:** remove explicit `10` or pass `DEFAULT_TABLE_PAGE_SIZE`.
3. **Local `const DEFAULT_PAGE_SIZE = 10`:** replace with import from `tablePagination.ts`.
4. **Strings / utils:** `REQUESTER_EMPLOYEE.DEFAULT_PAGE_SIZE`, `EMAIL_TO_PICKER_PAGE_SIZE`, `DAILY_REQUESTERS_PAGE_SIZE` → **25** (or re-export `DEFAULT_TABLE_PAGE_SIZE`).
5. **Services:** table-fetch defaults `pageSize = 10` → `DEFAULT_TABLE_PAGE_SIZE` where the param drives visible row count.

### Phase 3 — Custom pagination maps & edge cases

1. `RequesterList.tsx`: `postsPagination` default `pageSize: 10` → 25; `DAILY_REQUESTERS_PAGE_SIZE` → 25.
2. `PostPositionByStatusList.tsx`: fallback `{ pageSize: 10 }` → shared default.
3. `postPositionSlice.ts`: hardcoded `pageSize: 10` in `closeAssignmentsPagination` / `paginationByStatus` init → constant.
4. `availablePostService.ts`: `pageSize ?? 10` → `?? DEFAULT_TABLE_PAGE_SIZE`.
5. `SMSFailedTransactionsList`, `EmployeeFormPage` (if list display), `InvoiceList` callback default — align to 25.

### Phase 4 — Verification audit

Run ripgrep and fix stragglers:

```bash
rg "pageSize:\s*10|pageSize\s*=\s*10|initialPageSize:\s*10|DEFAULT_PAGE_SIZE\s*=\s*10|PAGE_SIZE\s*=\s*10" src/
```

Manually review hits:

- **Change** if user-facing table pagination.
- **Skip** if bulk fetch / dropdown / internal chunk (document in PR if ambiguous).

**Smoke-test pages (representative):**

- Department admin list (e.g. Pay Codes, Skills)
- Employee list
- Requester list + Daily Administration expanded posts
- Available jobs / scheduled jobs
- Audit log + Job Position Flow audit
- Payment list / Requester payment tabs
- Reports with pagination
- Email “To” picker modal pagination

Confirm: first load shows **25** rows; selector includes **5, 10, 25, 50, 100**; changing size refetches/resets page correctly.

---

## Files Likely Touched

- `src/constants/tablePagination.ts` *(primary)*
- `src/components/smsatoms/SMSPagination/SMSPagination.tsx`
- `src/hooks/usePagination.ts`
- `src/constants/strings.ts` (`REQUESTER_EMPLOYEE.DEFAULT_PAGE_SIZE`)
- `src/utils/emailUtils.ts`
- `src/store/slices/*` (paginated list slices — ~12 files)
- `src/services/paymentService.ts`, `refundPaymentService.ts`, `refundPaymentAllocationService.ts`, `requesterLedgerService.ts`, `availablePostService.ts`
- `src/features/**/**List*.tsx` and report pages with `initialPageSize: 10`
- `src/features/request-administration/pages/RequesterList/RequesterList.tsx`
- `src/features/request-administration/pages/RequesterList/DailyAdministration.tsx`
- `src/features/request-administration/pages/RequesterList/CloseAssignments.tsx`
- `src/features/request-administration/pages/RequesterList/UnclosedAssignments.tsx`
- `src/components/smsorganisms/SMSMasterDataShortLongStatusList/SMSMasterDataShortLongStatusList.tsx`
- `src/components/smsorganisms/SMSFailedTransactionsList/SMSFailedTransactionsList.tsx`
- `src/components/smsmolecules/PostPositionByStatusList/PostPositionByStatusList.tsx`

---

## Out of Scope

- Changing option set to only `[25]` or removing 5/10/50/100
- Backend API default page size (frontend sends explicit `pageSize`; backend should accept 25)
- Persisting user page-size preference across sessions (unless already exists — not part of ticket)
- Pagination on screens with no row-count selector

---

## Work Log

### [2026-08-03] - Planned

- Reviewed Jira summary from developer: DCR default rows per page **10 → 25**; **25** on all row-count selectors.
- Audited frontend pagination: centralized `DEFAULT_TABLE_PAGE_SIZE`, `SMSPagination` options already include 25; widespread hardcoded `10` in slices, pages, and services.
- Drafted phased plan: centralize constants → update defaults → custom UIs → grep audit + smoke tests.

### [2026-08-03] - Implemented

- Branch `feature/scrum-961-default-rows-per-page-25` created.
- `DEFAULT_TABLE_PAGE_SIZE` set to **25**; exported `TABLE_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100]`.
- `SMSPagination` uses shared constants; invalid page size fallback uses 25.
- Updated Redux slices, services, list pages, Requester daily admin, Close/Unclosed assignments, email picker, available-post slice, invoice list, and related components.
- `DailyAdministration` page-size menu uses `TABLE_PAGE_SIZE_OPTIONS`.
- Bulk dropdown fetches (`1000` / `10000`) left unchanged per plan.
- `npm run build` passes (tsc + vite).
- Plan moved to `plan-files/in-progress/`.

### [2026-08-03] - Completed

- All success criteria met; developer confirmed task complete.
- Plan moved to `plan-files/completed/`.

| Check | Result |
|---|---|
| Ticket goal matches proposed change | Yes — default 25 + 25 in all selectors |
| Minimal central change identified | Yes — `tablePagination.ts` + `SMSPagination` |
| Regression risk for bulk fetches | Controlled — exclude 1000/10000 dropdown loads |
| All custom pagination UIs covered | Yes — DailyAdministration, RequesterList called out |
| Success criteria measurable | Yes |
| Scope creep controlled | No session persistence / backend changes |

**Validation verdict:** Plan is ready for developer confirmation before Phase 1 coding.

---

## Approval Gate

Reply with:

1. **Approve plan** — start Phase 1, or  
2. **Adjust plan** — e.g. also change `REQUESTER_MANAGER.DEFAULT_PAGE_SIZE` from 100, or exclude email picker / daily requesters from 25 default.
