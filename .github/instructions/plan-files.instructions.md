---
applyTo: plan-files/
---

# Plan File Instructions for Copilot

This file provides detailed rules for working with plan files. The primary workflow is defined in `.github/copilot-instructions.md`.

---

## Checking Plans

### When to Check Plans
- At the start of any conversation about work
- When user says "check plans", "show plans", "plan status", or similar
- Before suggesting starting new work

### Output Format
Provide a consistent, terminal-friendly summary using this structure:

```
Plan Status Summary (as of [YYYY-MM-DD])

Overview: [X] in progress | [Y] pending | [Z] high priority

===============================================================================
IN PROGRESS ([COUNT] plans)
===============================================================================

HIGH PRIORITY:
  * [plan-name] (Scope: [Small/Medium/Large], Epic: [epic-name or NA])
    Branch: [branch-name] | Issue: [#123 or NA] | Started: [YYYY-MM-DD]

MEDIUM PRIORITY:
  * [plan-name] (Scope: [scope], Epic: [epic])
    Branch: [branch] | Issue: [#123 or NA] | Started: [date]

LOW PRIORITY:
  * [plan-name] (Scope: [scope], Epic: [epic])
    Branch: [branch] | Issue: [#123 or NA] | Started: [date]

PRIORITY NOT SET:
  * [plan-name] (created: [YYYY-MM-DD], started: [YYYY-MM-DD if available])
  * [plan-name] (created: [YYYY-MM-DD])

===============================================================================
TO DO ([COUNT] plans)
===============================================================================

HIGH PRIORITY:
  * [plan-name] (Scope: [Small/Medium/Large], Epic: [epic-name or NA])
    Issue: [#123 or NA]

MEDIUM PRIORITY:
  * [plan-name] (Scope: [scope], Epic: [epic])
    Issue: [#123 or NA]

LOW PRIORITY:
  * [plan-name] (Scope: [scope], Epic: [epic])
    Issue: [#123 or NA]

PRIORITY NOT SET:
  * [plan-name] (created: [YYYY-MM-DD]) | Issue: [#123 or NA]

===============================================================================
Next Steps: [Contextual suggestion based on current state]
===============================================================================
```

### Formatting Rules

1. **Date Format:** Always use ISO format (YYYY-MM-DD)
2. **Grouping:** Group by priority within each section (High → Medium → Low → Not Set)
3. **Sorting within groups:**
   - In-progress: Sort by started date (oldest first to highlight stale work)
   - To-do: Sort by scope then date (Small → Medium → Large, showing quick wins first)
4. **Handle missing data gracefully:**
   - If priority not set → put in "PRIORITY NOT SET" section
   - If scope not set → omit scope from display
   - If epic not set → show "Epic: NA"
   - If issue not set → show "Issue: NA"
5. **Issue format:** Show as "#123" for issue numbers, "NA" if not set
6. **Use emojis sparingly:** Only in section headers for visual scanning
7. **Consistent indentation:** 2 spaces for plan details, 4 spaces for metadata lines

### Contextual Next Steps

End with helpful suggestions based on what you see:
- **Multiple high priority items:** "You have [X] high priority plans. Which should we tackle first?"
- **No in-progress work:** "Would you like to start working on [highest priority plan]?"
- **Many in-progress items:** "You have [X] plans in progress. Would you like to complete some before starting new work?"
- **No plans at all:** "No plans found. Would you like to create one?"
- **Stale in-progress work:** "Plan '[name]' has been in progress since [date]. Need help completing it?"

### Data Collection Process

1. View `plan-files/in-progress/` directory
2. View `plan-files/to-do/` directory
3. For each plan file found, extract frontmatter fields:
   - name
   - status
   - priority (optional)
   - scope (optional)
   - epic (optional)
   - branch
   - created
   - started (optional)
   - issue (optional)
4. Look for epic subdirectories in `to-do/`
5. Format output according to template above

---

## Creating Plan Files

### File Location
- **New plans:** Start in `plan-files/to-do/` with status: `pending`
- **Epic plans:** Create in `plan-files/to-do/[epic-name]/`
- **Standalone plans:** Create in `plan-files/to-do/` (set epic: NA)

### File Naming
- Use kebab-case based on plan title
- Example: "Add User Authentication" → `add-user-authentication.md`
- Keep names concise but descriptive

### Required Information
When creating a plan, gather from developer:
1. **Priority:** High, Medium, or Low
2. **Scope:** Small (hours), Medium (days), Large (weeks)
3. **Epic:** Name of epic or NA
4. **Branch name:** feature/[name], fix/[name], or experiment/[name]

### Structure Template
Use `plan-files/TEMPLATE.md` as the base structure. Every plan must include:
- Complete frontmatter (all fields)
- Clear problem/goal statement
- Measurable success criteria
- Context manifest section
- Work log section

---

## Writing Success Criteria

Success criteria must be:
- ✅ **Specific and measurable** ("Add login endpoint that returns JWT" not "Make auth better")
- ✅ **Defines "done" unambiguously** (No subjective terms like "improve" or "enhance")
- ✅ **Formatted as checkboxes** (Use `- [ ]` for tracking)
- ✅ **Includes test verification** ("Tests pass for new login flow")

### Good Success Criteria Examples
```markdown
## Success Criteria
- [ ] Login endpoint accepts username/password and returns JWT token
- [ ] Failed login returns 401 with error message
- [ ] Token expires after 24 hours
- [ ] All auth tests pass (no need to run full test suite)
- [ ] Documentation updated with authentication flow
```

### Bad Success Criteria Examples
```markdown
## Success Criteria
- [ ] Make login better
- [ ] Improve security
- [ ] Users are happy with auth
```

---

## GitHub Issue Integration

### Always Offer Issue Creation
After creating a plan file, ask:
> "Would you like me to create a GitHub issue for this plan?"

### IF Developer Says Yes:
1. Use `gh issue create` with plan title and description
2. Add issue number to plan frontmatter: `issue: 123`
3. Ask about assignment:
   > "Would you like to assign this to yourself (@me) or a teammate?"
4. Use `gh issue edit` if assignment needed

### IF Developer Says No:
- Set `issue: NA` in frontmatter

---

## Plan File Lifecycle

### Status Values
- `pending` → Plan created, waiting to start
- `in-progress` → Actively working on plan
- `completed` → All success criteria met, ready for PR
- `blocked` → Waiting on external dependency

### Directory Movement
```
to-do/ (pending)
  ↓ "start working on plan"
in-progress/ (in-progress, no epic directory)
  ↓ "plan is complete"
[stays in in-progress until PR merged]
  ↓ [auto-moved by GitHub Action]
completed/ (completed)
```

### Git Workflow Mode

**Detect mode from .plan-files-config:**
- IF file exists with `"use_worktrees": true` → Worktree mode available (ask developer preference)
- IF file doesn't exist → Traditional branch mode only

**Detect if currently in a worktree:**
- Run: `git rev-parse --git-common-dir`
- IF output is `.git` → In main repository
- IF output is NOT `.git` → In a worktree

**Traditional Branch Mode:**
- Use `git checkout -b <branch-name>` for new branches
- Work in main repository directory
- Single plan-files/ directory for all work

**Worktree Mode:**
- Read `worktree_dir` from .plan-files-config
- Use `git worktree add <worktree_dir>/<plan-name> <branch-name>`
  - Replace `<worktree_dir>` with EXACT value from config file
  - Replace `<plan-name>` with kebab-case plan name
  - Replace `<branch-name>` with branch from plan frontmatter
- Each worktree has isolated plan-files/ directory
- Developer chooses per plan whether to use worktree or branch
- After PR merge, remind developer: `git worktree remove <worktree_dir>/<plan-name>` (use value from config)

### Branch Alignment
- Branch name in frontmatter MUST match actual git branch
- Always verify branch before committing
- Never commit to main/master

---

## Updating Plan Files

### During Active Work
- Update work log with date entries as progress is made
- Check off success criteria boxes as completed
- Add any new context discovered during implementation
- Suggest commits when logical units of work are done

### At Stop Points
Add to work log:
- What was completed in this session
- Current state of the work
- **Clear next steps** for resuming work
- Any blockers or questions

Example:
```markdown
## Work Log
- [2026-01-30] Implemented login endpoint
  - Created POST /auth/login route
  - Added JWT generation logic
  - Next: Add token expiration logic and write tests
  - Question: Should we support refresh tokens?
```

### At Completion
- Verify ALL success criteria are checked
- Add final work log entry summarizing total work
- Document any deviations from original plan
- Update status to `completed`
- Note any follow-up work needed

---

## Testing Expectations

When success criteria mention tests:
- Run only relevant tests for the changed code
- New tests should pass
- Modified tests should pass
- **No need to run full test suite** (CICD handles that)

Report test results to developer:
> "✅ All authentication tests passing (5 tests run)"

---

## Context Manifest

Use this section to store:
- Links to relevant documentation
- Related issues or PRs
- Technical decisions made
- Dependencies or prerequisites
- Files that will be modified

Keep this updated as you learn more during implementation.

---

## Tips for Effective Plans

1. **Break down large plans** into smaller sub-plans (create epic)
2. **Be specific in scope** to avoid scope creep
3. **Update frequently** don't wait until completion
4. **Include "why"** not just "what" in problem statements
5. **Link related plans** by mentioning them in context manifest


