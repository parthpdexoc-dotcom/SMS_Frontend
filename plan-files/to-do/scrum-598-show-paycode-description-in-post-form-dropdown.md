---
name: scrum-598-show-paycode-description-in-post-form-dropdown
branch: feature/scrum-598-paycode-description-dropdown
status: pending
priority: Medium
scope: Small
epic: NA
created: 2026-04-04
issue: NA
---

# Show paycode description in post form dropdown (SCRUM-598)

## Problem/Goal

The post form pay code dropdown (`SMSPostForm`) currently shows only `payCodeValue` in each option. Users need to see the **description** next to the code so they can pick the right pay code without guessing.

**Display rule (product):** Each option label must look like **`{value} - {description}`**, e.g. `001 - test` (space-hyphen-space between value and description).

**Why this matters:** Pay codes are short codes; descriptions carry the meaning. Showing both in the list matches Jira [SCRUM-598](https://checkthesite.atlassian.net/browse/SCRUM-598) and reduces selection errors.

---

## Success Criteria

- [x] Pay code dropdown options use label format **`{payCodeValue} - {payCodeDescription}`** when `payCodeDescription` is non-empty (after trim).
- [x] When description is missing or empty after trim, show **only** `payCodeValue` (no trailing ` - `).
- [x] Submitted value is unchanged: still **PayCodeID** (GUID) in form state / API payload.
- [x] Searchable dropdown still works: users can find options by typing part of the **value** or **description** (label includes both).
- [x] Lint/tests pass for touched code (no new issues from this change; project lint has pre-existing findings).

---

## Context Manifest

### Related Work

- Jira: [SCRUM-598](https://checkthesite.atlassian.net/browse/SCRUM-598) — *show paycode description in dropdown*
- GitHub issue: NA (add to frontmatter if `gh issue create` is used later)

### Technical Context

- **Data:** `PayCodeResponse` already includes `payCodeValue` and `payCodeDescription` (`src/types/payCode.ts`).
- **Primary change:** `payCodeOptions` in `src/components/smsorganisms/SMSPostForm/SMSPostForm.tsx` — build `label` from value + description per rules above.
- **Component:** `SMSDropdown` uses `{ value, label }` only; no API change required if list payload already includes descriptions.
- **View mode:** `DataDisplay` for Paycode uses the same `payCodeDisplayLabel` for parity with the dropdown.

### Decisions Made

- [2026-04-04] Label separator: ` - ` (space, hyphen, space), as in `001 - test`. Empty description → value only.

### References

- Plan workflow: `.github/copilot-instructions.md`
- Pay code admin list (reference for fields): `src/features/department-administration/pages/PayCodeList/PayCodeList.tsx`

---

## User Notes

- Exact format: **`001 - test`** (code, space-hyphen-space, description).

---

## Work Log

### [2026-04-04] - Planned

- Ticket reviewed; implementation scoped to `SMSPostForm` `payCodeOptions` label construction.
- Label format confirmed with developer: `{value} - {description}`.

### [2026-04-04] - Implemented

- Added module helper `payCodeDisplayLabel` in `SMSPostForm.tsx`.
- Wired `payCodeOptions` labels and view-mode Paycode `DataDisplay` to use it.

---

## Implementation sketch (for implementer)

```ts
// Pseudocode inside payCodeOptions map:
const value = (item.payCodeValue ?? '').trim();
const desc = (item.payCodeDescription ?? '').trim();
const label = desc ? `${value || '—'} - ${desc}` : (value || '—');
```

Adjust only if edge cases appear (e.g. value empty but description present — rare; prefer sensible fallback).
