# In-Progress Plans

This directory contains plan files with status: `in-progress` — currently being worked on.

---

## Active Work Guidelines

### Update Regularly
- Check off success criteria as you complete them
- Add work log entries with dates
- Document decisions and context as you discover it
- Keep the plan file synchronized with code changes

### Commit Frequently
When you complete a logical unit of work:
1. Update the plan file work log
2. Stage both code changes AND plan file
3. Commit with descriptive message
4. Confirm with developer before committing

### Track Progress
```markdown
## Success Criteria
- [x] First goal (completed)
- [x] Second goal (completed)
- [ ] Third goal (in progress)
- [ ] Fourth goal (not started)
```

---

## Creating Stop Points

When pausing work (end of day, switching tasks, etc.):

### Update Work Log
Add an entry with:
- What was accomplished this session
- Current state of the work
- **Clear next steps** for resuming
- Any blockers or open questions

### Example Stop Point
```markdown
### [2026-01-30] - Session 2
- Implemented login endpoint logic
- Added JWT token generation
- Current state: Endpoint works but needs tests
- Next steps:
  1. Write tests for successful login
  2. Write tests for failed login
  3. Add token expiration validation
- Question: Should we support refresh tokens now or later?
```

### Commit the Update
- Commit plan file changes before pausing
- Message: "Stop point: [brief description]"

---

## Testing Requirements

### When Success Criteria Mention Tests
- Run tests for code you changed/added
- Verify new tests pass
- Verify modified tests pass
- **No need to run full test suite** (CI/CD handles that)

### Report Results
Let the developer know test status:
> "✅ All authentication tests passing (5 tests run)"

---

## Finishing a Plan

A plan is complete when:
- ✅ ALL success criteria are checked off
- ✅ Tests pass for changed code
- ✅ Developer explicitly confirms completion
- ✅ Final work log entry added
- ✅ Status updated to `completed`

**Important:** Plan files stay in `in-progress/` until the PR is merged. They are moved to `completed/` automatically (if workflow exists) or manually after merge.

---

## Managing Multiple Plans

You can have multiple plans in progress simultaneously:

### Traditional Branch Mode
```bash
# Working on authentication plan
git checkout feature/add-authentication

# Switch to different plan
git checkout feature/refactor-database
```

### Worktree Mode
```bash
# Each plan in its own directory
cd ../worktrees/add-authentication    # Work on auth
cd ../worktrees/refactor-database     # Work on database

# Each worktree has isolated plan-files/ directory
# No need to switch branches - just change directories
```

**Tip:** Worktrees are great for context switching without losing work-in-progress state.

---

## When You Get Blocked

If you can't complete a plan due to external dependencies:

1. Update status to `blocked`
2. Document the blocker in work log
3. Note what's needed to unblock
4. Commit the status change

```markdown
status: blocked

## Work Log
### [2026-01-30] - Blocked
- Cannot proceed: waiting for API key from DevOps team
- Blocker: Issue #456 filed with DevOps
- Can resume when: API key is provided
```

---

## Best Practices

✅ **Commit plan changes with code changes** — keep them in sync
✅ **Be specific in work log** — help your future self or teammates
✅ **Update context as you learn** — capture decisions and discoveries
✅ **Create stop points regularly** — don't rely on memory
✅ **Communicate blockers immediately** — don't wait
