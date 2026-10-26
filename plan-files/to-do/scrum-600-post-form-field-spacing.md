---
name: scrum-600-post-form-field-spacing
branch: feature/scrum-600-post-ui-field-spacing
status: pending
priority: Medium
scope: Small
epic: NA
created: 2026-04-04
issue: NA
---

# Post UI: consistent vertical spacing between fields (SCRUM-600)

## Problem/Goal

Jira [SCRUM-600](https://checkthesite.atlassian.net/browse/SCRUM-600) — **Post UI fix**: some fields sit too close together vertically. **Location** and **Description** already have acceptable separation; the rest of the post form should use similar vertical spacing so the layout is readable and consistent.

**Why this matters:** Cramped fields are harder to scan and increase mis-entry risk; aligning spacing with the location/description block matches explicit product feedback in the ticket.

---

## Success Criteria

- [x] Edit mode (`SMSPostForm`): vertical gap between stacked field rows is **visually consistent** with the gap between **Location** and **Description** (use that pair as the reference).
- [ ] No regression on horizontal layouts (checkbox + dropdown rows, time pickers, multi-column grids).
- [ ] If view mode is called out in QA, **FormViewSection** / post view layout is checked; otherwise scope stays **edit form** unless the screenshot shows view mode issues.
- [ ] Quick visual pass on narrow breakpoints (stacked columns).

---

## Context Manifest

### Related Work

- Jira: [SCRUM-600](https://checkthesite.atlassian.net/browse/SCRUM-600)
- Ticket text: *“there is no space between some fields, there should be some space like between location and description.”*

### Technical Context (initial findings)

- **Primary file:** `src/components/smsorganisms/SMSPostForm/SMSPostForm.tsx`
- **Single outer grid:** Section paper uses **one** `<SMSGrid container rowSpacing={1} columnSpacing={0.75}>` for checkboxes through paycode/contact rows (merged 2026-04-04) so `rowSpacing` applies **between** activity-type row and time row.
- Earlier bug: **two** sibling grid containers — `rowSpacing` did not add gap **between** container A’s last row and container B’s first row.
- **CSS:** `SMSPostForm.css` defines `.post-form__field-row { margin-bottom: 0 }`, which removes extra margin on some inner stacks — worth verifying after Grid spacing is fixed so we do not double-stack gaps.

### Proposed direction (for implementer)

1. Add **`rowSpacing` / `columnSpacing`** (or legacy `spacing`) to the **first** `SMSGrid container` so it matches the second (e.g. `rowSpacing={1} columnSpacing={0.75}` — confirm against MUI Grid API used by `SMSGrid`).
2. Re-check **nested** grids (e.g. department activity type + total positions) so inner `spacing` does not fight the outer row gap; adjust only if rows look uneven.
3. Compare with Jira screenshot in browser; tweak token in `SMSPostForm.css` only if Grid spacing alone is insufficient.

### References

- Plan workflow: `.github/copilot-instructions.md`
- View layout reference: `FormViewSection.css` (`gap` on `.form-view-section__content`)

---

## User Notes

- Ticket includes a screenshot — use it as the final arbiter for which rows looked wrong.

---

## Work Log

### [2026-04-04] - Planned

- Pulled SCRUM-600 summary and description from Jira.
- Identified split `SMSGrid` layout in `SMSPostForm` edit mode as primary hypothesis for uneven vertical spacing.

### [2026-04-04] - Implemented

- Set first section-paper `SMSGrid container` to `rowSpacing={1} columnSpacing={0.75}` to match the time/location/description grid.

### [2026-04-04] - Time row follow-up

- **Issue:** Start Time / Job Length / Minimum Hours still looked cramped: flex rules targeted inner TextField class names, but **flex items** are `SMSTimePicker`’s outer `Box`.
- **Fix:** `SMSPostForm.css` — `.post-form__time-row > * { flex: 1 1 0; min-width: 0 }`, row `gap: var(--pf-gap-md)`.

### [2026-04-04] - Vertical gap above time row (root cause)

- **Issue:** No space between “Department Activity Type / Total Positions” and “Start Time / Job Length” row.
- **Cause:** The form used **two sibling** `<SMSGrid container rowSpacing={…}>` blocks inside the same paper. MUI **`rowSpacing` only inserts gap between rows inside that container** — not between the last row of grid A and the first row of grid B.
- **Fix:** **Merge** into a **single** outer grid so the time row is the next row in the same container; `rowSpacing={1}` then applies correctly.
- **CSS:** Restored `.post-form__time-row > *` flex + `gap: var(--pf-gap-md)` because `className` remains on the inner `TextField` after user revert of `SMSTimePicker` changes.
