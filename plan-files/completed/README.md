# Completed Plans

This directory contains plan files with status: `completed` — all success criteria met and work merged to main branch.

---

## What Lives Here

Completed plans serve as:
- **Documentation** of decisions and implementation details
- **Historical record** of work done
- **Reference material** for similar future work
- **Onboarding resource** for new team members

**Do not delete completed plans.** They are valuable project history.

---

## How Plans Get Here

### Automatic (Recommended)
If `.github/workflows/move-completed-plans.yml` exists:
- Plans automatically move here when PR is merged
- No manual intervention needed
- Keeps workflow clean and consistent

### Manual
If no workflow exists:
- Developer or Copilot manually moves plan after merge
- Remember to update status to `completed`

---

## Plan Completion Checklist

Before a plan is moved to completed:

- ✅ All success criteria checked off
- ✅ Tests passing for changed code
- ✅ Developer explicitly confirmed completion
- ✅ Final work log entry added
- ✅ Status set to `completed`
- ✅ Code merged to main/master branch
- ✅ PR closed

---

## Final Work Log Entry

The last work log entry should include:

### Summary of Work
Brief overview of what was implemented

### Deviations from Plan
Any changes from original plan and why

### Follow-up Work
Any related work that should be done later (create new plans for these)

### Example
```markdown
### [2026-01-30] - Completed
- Implemented full JWT authentication flow
- Added 8 tests (all passing)
- Deviation: Used HS256 instead of RS256 per team discussion
- Follow-up: Add refresh token support (plan-files/to-do/add-refresh-tokens.md)
- Merged in PR #123, closes #456
```

---

## Organizing Completed Plans

### By Epic
Completed plans maintain their epic structure:
```
completed/
└── user-authentication/
    ├── add-login-endpoint.md
    └── add-jwt-tokens.md
```

### By Date
Plans include `created` date in frontmatter for chronological sorting

### By Priority
Frontmatter includes priority for filtering high-impact work

---

## Using Completed Plans

### As Reference
When starting similar work:
1. Search completed/ for related plans
2. Review decisions and context
3. Learn from what worked (and what didn't)

### For Onboarding
New team members can:
- Read completed plans to understand system evolution
- See patterns in how work is planned and executed
- Learn technical decisions and their rationale

### For Retrospectives
Use completed plans to:
- Review estimation accuracy (scope vs actual time)
- Identify patterns in blockers
- Celebrate accomplishments
- Improve planning process

---

## Frontmatter of Completed Plans

Completed plans should have:
```yaml
status: completed
issue: 123 (or NA)
```

All other frontmatter remains unchanged for historical accuracy.

---

## Don't Delete Plans

Completed plans might seem like clutter, but they provide:
- Answers to "why did we do it this way?"
- Evidence of progress over time
- Training data for improving planning
- Searchable knowledge base

If you're concerned about clutter, consider:
- Archiving by year: `completed/2026/`
- Filtering by git history
- Using search tools instead of browsing

---

## Metrics You Can Track

With completed plans, you can analyze:
- **Velocity:** How many plans completed per week/sprint
- **Accuracy:** Estimated scope vs actual time taken
- **Quality:** Correlation between thorough planning and smooth implementation
- **Impact:** High priority plans completed vs total work

---

## Quick Reference

**Check completed plans:** Browse this directory or use git log
**Find specific plan:** Use grep or repository search
**Review epic progress:** Look in epic subdirectories
**Understand system history:** Read chronologically by creation date
