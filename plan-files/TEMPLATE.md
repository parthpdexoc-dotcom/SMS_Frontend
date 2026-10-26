---
name: [prefix]-[descriptive-kebab-case-name]
branch: feature/[name]|fix/[name]|experiment/[name]
status: pending|in-progress|completed|blocked
priority: High|Medium|Low
scope: Small|Medium|Large
epic: [epic-name]|NA
created: YYYY-MM-DD
issue: [issue-number]|NA
---

# [Human-Readable Title]

## Problem/Goal

[Clear, concise description of what we're solving or building]

**Why this matters:** [Brief context on importance or impact]

---

## Success Criteria

Define specific, measurable outcomes. Use checkboxes for tracking.

- [ ] Specific outcome 1 (e.g., "Login endpoint returns JWT token")
- [ ] Specific outcome 2 (e.g., "Failed login returns 401 with error message")
- [ ] Tests pass for new/modified code
- [ ] Documentation updated (if applicable)

---

## Context Manifest

Capture all relevant context here. Update as you learn more during implementation.

### Related Work
- Related issues: #[issue-number]
- Related PRs: #[pr-number]
- Related plans: [plan-file-name.md]

### Technical Context
- Dependencies: [List any dependencies]
- Files to modify: [List expected files]
- APIs/Libraries: [External resources]

### Decisions Made
- [Date] Decision: [Description and rationale]

### References
- [Documentation links]
- [Design docs or specs]
- [Stack Overflow or other helpful resources]

---

## User Notes

Any specific requirements, preferences, or constraints from the developer.

- [Note 1]
- [Note 2]

---

## Work Log

Update regularly as work progresses. Include date for each entry.

### [YYYY-MM-DD] - Started
- Initial research and planning
- Set up branch and moved plan to in-progress

### [YYYY-MM-DD] - Session 1
- [What was accomplished]
- [Current state]
- [Next steps]

### [YYYY-MM-DD] - Completed
- [Final summary of work]
- [Any deviations from plan]
- [Follow-up work needed (if any)]

---

## Examples

Below are examples of well-written plan files:

**Good Problem Statement:**
> We need to add user authentication to the API. Currently, all endpoints are public, which poses a security risk. We'll implement JWT-based authentication with login and token validation.

**Bad Problem Statement:**
> Make auth better.

**Good Success Criteria:**
- [ ] POST /auth/login endpoint accepts username/password
- [ ] Endpoint returns JWT with 24-hour expiration
- [ ] All protected endpoints validate JWT
- [ ] Invalid tokens return 401 with clear error message
- [ ] Auth tests pass (5 new tests added)

**Bad Success Criteria:**
- [ ] Auth works
- [ ] Users can log in
- [ ] It's secure
