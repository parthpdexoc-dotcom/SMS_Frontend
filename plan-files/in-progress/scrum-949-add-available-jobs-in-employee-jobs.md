---
name: scrum-949-add-available-jobs-in-employee-jobs
branch: feature/scrum-949-available-jobs-employee-jobs
status: in-progress
priority: Medium
scope: Medium
epic: NA
created: 2026-07-17
issue: NA
---

# Add Available Jobs in Employee Jobs (SCRUM-949)

## Problem/Goal

Supervisors can open **Employee Jobs** (`/personnel/employee-jobs/:employeeId`) and already see **Scheduled Job**, **Job Ready to Close**, and **My History** for a selected employee. They cannot see that employee’s **Available Job** list (Open / Cancelled / Tenure Based / Managed / Preferred), even though the employee’s own Dashboard (`/available-jobs`) has the full Available Job experience.

**Why this matters:** Supervisors need the same available-job visibility for a specific employee so they can review what that employee can take or express interest in, without logging in as that employee. Jira: [SCRUM-949](https://checkthesite.atlassian.net/browse/SCRUM-949).

---

## Success Criteria

- [ ] Employee Jobs detail (`/personnel/employee-jobs/:employeeId`) shows an **Available Job** tab alongside existing Scheduled / Ready to Close / History tabs.
- [ ] Available Job on Employee Jobs supports the same release categories as the employee Dashboard: **Open**, **Cancelled Jobs**, **Tenure Based**, **Managed**, **Preferred** (including Managed group + nested sub-tabs when tier allows).
- [ ] List is scoped to the **selected employee** (not the logged-in supervisor), via explicit `employeeId` on API calls (same pattern as Scheduled / History).
- [ ] Filters work for that employee view: start date, number of days, release category, requester, pay code, waiting-list toggle (where supported), and server-side pagination.
- [ ] Job **details** (view-details / attachments / special-event roster where already shown) work for rows in this view.
- [ ] Action policy is implemented per product decision (see Open Decisions): either **view-only** or **act-on-behalf** for Take Job / Express Interest / Special Event / waiting cancel.
- [ ] Employee’s own `/available-jobs` Dashboard behavior is unchanged when `employeeId` is omitted.
- [ ] Strings come from `@/constants/strings`; no hardcoded user-facing copy.
- [ ] Lint/typecheck pass for touched files (no new issues introduced by this change).

---

## Context Manifest

### Related Work

- Jira: [SCRUM-949](https://checkthesite.atlassian.net/browse/SCRUM-949) — *Add available jobs in employee jobs.*
- Prior frontend analysis (this chat): Available Job APIs, release tabs, Redux flow, Employee Posts gap.
- GitHub issue: NA (offer create after plan approval)

### Technical Context

**Current Employee Jobs UI**

- Page: `src/features/employee-administration/pages/EmployeePostsPage/EmployeePostsPage.tsx`
- Tabs today (explicit subset): `EMPLOYEE_POSTS_JOBS_TAB_IDS` in `src/constants/availableJobsRouteTabs.ts` — Scheduled, Ready to Close, My History only.
- Those lists already pass `employeeId` + `employeeNameOverride` into shared list components.

**Current Available Job UI (employee self)**

- Dashboard: `src/features/employee-administration/pages/EmployeeDashboard/EmployeeDashboard.tsx`
- List: `src/components/smsorganisms/SMSAvailablePostList/SMSAvailablePostList.tsx` — **no `employeeId` prop today**
- Filter: `src/components/smsmolecules/SMSAvailablePostFilter/SMSAvailablePostFilter.tsx`
- Redux: `src/store/slices/availablePostSlice.ts` — JWT-scoped; no `employeeId`
- Service: `src/services/availablePostService.ts`

**APIs used by Available Job**

| Category | Method | Endpoint | Notes |
|---|---|---|---|
| Open / Tenure / Managed / Preferred | GET | `/Request/available-post` | Query: `StartDate`, `NumberOfDays`, `ReleaseAs`, optional `Requester`, `PayCode`, `DisplayWaitingList` — **no `employeeId` today** |
| Cancelled | POST | `/PostPosition/my-post-positions/by-statuses` body `[14]` | Already supports `employeeId` via post-position filters |
| Requester filter | GET | `/Request/dashboard-requesters` | Date-scoped; likely needs employee scope if eligibility differs |
| Details | GET | `/Request/view-details` | Shared |
| Take Job | GET | `/Request/assign-post-to-me` | Self-only today (JWT) |
| Tenure interest | GET | `/WaitingPostPosition/assign-tenure-position-to-me` | Self-only today |
| Special event | POST | `/WaitingPostPosition/special-event` | Self-only today |

**Release categories** (`ReleaseAs` in `src/types/request.ts`)

- Open = 0, TenureBased = 1, Managed = 2, Preferred = 3, Cancelled = 4
- Tab visibility driven by JWT `ReleaseAsTabTier` (`src/utils/availablePostReleaseTabs.ts`)

**Proven pattern to copy**

- `SMSScheduledPostList` / `PostPositionByStatusList` accept optional `employeeId` and pass it through Redux → service → query param when present; omit for self/JWT scope.

### Decisions Made

- [2026-07-17] Plan-first per `.github/copilot-instructions.md`; no coding until plan is approved.
- [2026-07-17] Ticket scope title is Available Jobs in Employee Jobs; Waiting List tab is **out of scope unless** product asks to include it (documented under Open Decisions).

### Open Decisions (must confirm before / during implementation)

1. **Backend `employeeId` support**
   - Frontend cannot correctly show another employee’s available jobs by only mounting `SMSAvailablePostList` today — it would still hit JWT-scoped `/Request/available-post`.
   - Need backend (or confirmed existing) optional `employeeId` (or supervisor-specific endpoint) on at least:
     - `GET /Request/available-post`
     - Prefer also: `GET /Request/dashboard-requesters` if options are employee-eligibility-dependent
   - Cancelled path can reuse existing `employeeId` on by-statuses.

2. **View-only vs act-on-behalf**
   - **Recommended default for v1:** View + details only (hide/disable Take Job, Express Interest, Special Event apply, waiting-list apply) unless product explicitly wants supervisors to assign/express interest for the selected employee.
   - If act-on-behalf: assignment/waiting APIs must accept target `employeeId` and authorize supervisor role.

3. **Release tab tier source**
   - Whose `ReleaseAsTabTier` / `EnableOpenWaitingList` should drive category tabs?
   - **Recommended:** selected employee’s eligibility (requires employee profile/JWT-claims endpoint or fields on employee record). Fallback if unavailable: show all categories and let API return empty / error messages.

4. **My Waiting List**
   - Ticket says Available Jobs only. Include Waiting List tab only if confirmed.

### References

- Plan workflow: `.github/copilot-instructions.md`, `plan-files/TEMPLATE.md`
- Employee self dashboard: `/available-jobs/available-job`
- Supervisor page: `/personnel/employee-jobs/:employeeId`

---

## User Notes

- From discussion: Available Jobs section should include all dashboard Available Job features (Open, Cancelled, Managed group, Tenure Based, Preferred) **for that particular employee**.
- Explanation of current frontend flow was prepared for backend Cursor so they can add employee-scoped APIs if missing.
- Do not start coding until this plan is approved/confirmed.

---

## Implementation Approach

### Phase 0 — Backend contract confirmation (gate)

Before UI wiring:

1. Confirm whether `GET /Request/available-post` already accepts `employeeId` (query) when caller is supervisor/admin.
2. Confirm response shape stays the same (`data`, `totalRecords`, `error`, `hasOutstandingReadyToClosePost`).
3. Confirm Cancelled via by-statuses with `employeeId` is sufficient for Cancelled Jobs tab.
4. Confirm product decision: view-only vs act-on-behalf; Waiting List in/out.
5. If backend not ready: keep frontend plumbing behind a clear TODO / blocked note; do not ship a tab that shows the **supervisor’s** jobs for the wrong employee.

### Phase 1 — Thread `employeeId` through Available Job stack

1. **Types** (`src/types/availablePost.ts` or related)
   - Extend search/fetch params to optional `employeeId`.

2. **Service** (`availablePostService.ts`)
   - `getAvailablePosts`: append `employeeId` when provided.
   - Cancelled branch: pass `employeeId` into `getPostPositionsByStatus` filters (already supported).
   - `getDashboardRequesterFilterOptions`: append `employeeId` if backend supports it.

3. **Redux** (`availablePostSlice.ts`)
   - Thunk args for `fetchAvailablePosts` / waiting-list fetch accept optional `employeeId`.
   - Do not break self-dashboard calls (omit param).

4. **UI props**
   - `SMSAvailablePostList`: add optional `employeeId`, `employeeNameOverride`, and `readOnlyActions?: boolean` (or derive readOnly when `employeeId` is set and product = view-only).
   - Pass `employeeId` into filter fetch + list fetch.
   - When `readOnlyActions`: hide/disable `SMSTakeShiftAction` / `SMSSpecialEventApplyAction` (keep eye/details/roster as allowed).

5. **Filter**
   - Ensure URL sync for Employee Jobs does not fight employee-dashboard URL reset behavior; prefer local/applied filter state when embedded under Employee Posts (or namespace query keys if both can share URL patterns).

### Phase 2 — Wire Employee Posts page

1. Extend `EMPLOYEE_POSTS_JOBS_TAB_IDS` to include `AVAILABLE_JOB`.
2. Add tab option to `TAB_ITEMS` in `EmployeePostsPage.tsx` (label from `AVAILABLE_POST.TABS` / existing strings).
3. Render `<SMSAvailablePostList employeeId={...} employeeNameOverride={...} readOnlyActions={...} />` for that tab.
4. Default active tab: keep **Scheduled** as default (current behavior) unless product wants Available Job first.
5. Suspension / outstanding-ready-to-close: decide whether supervisor view still shows Available Job when selected employee is suspended (recommended: still show list for review; actions remain disabled if view-only).

### Phase 3 — Release tier for selected employee (if data available)

1. If employee DTO/API exposes release-tab tier (or equivalent flags), use that for `SMSAvailablePostFilter` access resolution instead of supervisor JWT.
2. Else document temporary limitation: tabs follow supervisor JWT or show full set; API enforces eligibility.

### Phase 4 — QA / regression

1. Supervisor opens Employee Jobs → Available Job → each release category returns that employee’s rows.
2. Same supervisor’s own Dashboard Available Job still shows **their** jobs.
3. Filters + pagination refresh correctly.
4. Details modal works; actions respect policy.
5. Cancelled Jobs uses by-statuses + `employeeId`.
6. No Redux crosstalk when switching employees (reset available-post state on employee change / unmount).

---

## Files Likely Touched

- `src/constants/availableJobsRouteTabs.ts`
- `src/features/employee-administration/pages/EmployeePostsPage/EmployeePostsPage.tsx`
- `src/components/smsorganisms/SMSAvailablePostList/SMSAvailablePostList.tsx` (+ css if needed)
- `src/components/smsmolecules/SMSAvailablePostFilter/SMSAvailablePostFilter.tsx` (if employeeId / access props needed)
- `src/store/slices/availablePostSlice.ts`
- `src/services/availablePostService.ts`
- `src/types/availablePost.ts` (and related types if needed)
- `src/constants/strings.ts` (only if new labels required)
- Possibly action molecules if read-only mode needs a prop

---

## Out of Scope (unless confirmed)

- Adding **My Waiting List** tab to Employee Jobs
- Admin Open Jobs / Tenure Jobs dashboards (`/Request/open-jobs-dashboard`, tenure dashboard)
- Changing employee self Dashboard UX
- Backend implementation itself (frontend consumes contract; coordinate via backend Cursor prompt if missing)

---

## Backend Cursor handoff (if `employeeId` missing)

Ask backend to document/implement optional `employeeId` on:

- `GET /Request/available-post`
- `GET /Request/dashboard-requesters` (if needed)
- Assignment/waiting mutations **only if** act-on-behalf is required

Must authorize: caller is supervisor/admin for that employee’s department; never trust client alone.

---

## Work Log

### [2026-07-17] - Planned

- Reviewed `.github/copilot-instructions.md` plan-first workflow.
- Reviewed Jira SCRUM-949 summary: *Add available jobs in employee jobs.*
- Mapped current Employee Posts vs Available Job frontend; confirmed Available Job stack is JWT-scoped and lacks `employeeId`.
- Drafted implementation plan with backend gate and open product decisions.

### [2026-07-17] - Decisions confirmed by developer

- Backend `GET /Request/available-post` accepts `employeeId` query param → pass it.
- Supervisor view is **read-only**: hide Take Job, Express Interest, Apply to Special Event, waiting-list apply.
- Show all release types without tier gating — logged-in admin's `ReleaseAsTabTier` must NOT be used for the selected employee.
- Use the same grouped UI as the employee dashboard: Open / Cancelled Jobs / Managed, with Tenure Based / Managed / Preferred nested under Managed.
- Cancelled Jobs continue via `POST /PostPosition/my-post-positions/by-statuses` body `[14]` with `employeeId` (never `ReleaseAs=4` on available-post).
- Keep `GET /Request/dashboard-requesters` for the requester filter.
- Employee's own dashboard unchanged (omits `employeeId`).

### [2026-07-17] - Implemented

- `availablePostService.getAvailablePosts`: new `options.employeeId` → appended as `employeeId` query param on `/Request/available-post`; Cancelled branch passes it as `employeeID` filter to by-statuses (existing support).
- `availablePostSlice`: `fetchAvailablePosts` / `fetchWaitingListPosts` thunk args accept optional `employeeId`.
- `SMSAvailablePostList`: new optional `employeeId` prop; presence makes the view read-only (row + modal take/apply actions hidden, outstanding-ready-to-close panel suppressed); `employeeId` included in fetch deps (page resets to 1 on any filter/employee change) and all pagination fetches.
- `SMSAvailablePostFilter`: new `showAllReleaseTabs` prop bypasses JWT `ReleaseAsTabTier` and exposes all release types using the dashboard's Managed group layout.
- `availableJobsRouteTabs.ts`: `AVAILABLE_JOB` added to `EMPLOYEE_POSTS_JOBS_TAB_IDS`.
- `EmployeePostsPage`: Available Job tab added first and made default; renders `<SMSAvailablePostList key={employeeId} employeeId={employeeId} />`; dispatches `resetAvailableJobEntry` on tab entry / employee change so state never leaks between admin dashboard and per-employee views.
- Verified: `tsc --noEmit` passes; no linter errors in touched files.
- Not committed yet; branch `feature/scrum-949-available-jobs-employee-jobs` not created (awaiting developer git confirmation per workflow).

---

## Plan Validation Checklist (review before coding)

| Check | Result |
|---|---|
| Ticket goal matches proposed UI change | Yes — Available Job on Employee Jobs for selected employee |
| Reuses existing Available Job UI (not a second dashboard) | Yes — extend `SMSAvailablePostList` + wire page tabs |
| Matches existing supervisor `employeeId` pattern | Yes — same as Scheduled/History |
| Backend dependency identified | Yes — `/Request/available-post` must accept `employeeId` (or equivalent) |
| Self-dashboard regression risk addressed | Yes — optional param; omit for self |
| Scope creep controlled | Waiting List / act-on-behalf marked as decisions |
| Success criteria measurable | Yes |

**Validation verdict:** Plan is ready for developer confirmation. **Blocker before Phase 1 code:** confirm Open Decisions #1–#2 (backend `employeeId` + view-only vs act-on-behalf). Optional: #3–#4 (tier source, Waiting List).

---

## Approval Gate

Reply with confirmation, e.g.:

1. **Approve plan** (and answer Open Decisions), or
2. **Adjust plan** (list changes), then approve.

Suggested answers to unblock coding:

- Backend `employeeId` on available-post: **ready / not ready / unknown — check**
- Actions: **view-only** (recommended) / **act-on-behalf**
- Waiting List tab: **no** (recommended) / **yes**
- Release tabs: **selected employee if possible** / **supervisor JWT** / **show all**
