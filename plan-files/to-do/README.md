# Pending Plans

This directory contains plan files with status: `pending` — ready to be started but not yet in progress.

---

## What Happens When You Start a Plan

When the developer says they're ready to work on a plan:

1. **Plan file moves** from `to-do/` → `in-progress/`
2. **Status changes** from `pending` → `in-progress`
3. **Git workflow** — Choose one:
   - **Traditional:** `git checkout -b <branch-name>`
   - **Worktree:** `git worktree add <worktree-dir>/<plan-name> <branch-name>`
4. **Initial commit** includes the moved plan file

---

## Git Workflow Options

### Traditional Branch Mode
```bash
# Create and switch to new branch
git checkout -b feature/add-authentication

# Work in main repository
# Single plan-files/ directory
```

### Worktree Mode (Optional)
```bash
# Create isolated worktree for this plan
git worktree add ../worktrees/add-authentication feature/add-authentication

# Work in separate directory
# Each worktree has its own plan-files/

# After PR merges, cleanup:
git worktree remove ../worktrees/add-authentication
```

**Note:** If `.plan-files-config` exists with worktree mode enabled, Copilot will offer both options when starting a plan.

---

## Before Starting a Plan

Confirm with Copilot that:
- ✅ Success criteria are clear and measurable
- ✅ Priority and scope are set appropriately
- ✅ Branch name follows convention (feature/, fix/, experiment/)
- ✅ Any dependencies or blockers are noted

---

## Organizing with Epics

Plans can be grouped into epic subdirectories:

```
to-do/
├── epic-name/
│   ├── plan-1.md
│   └── plan-2.md
└── standalone-plan.md
```

Plans within an epic should set `epic: epic-name` in their frontmatter.

---

## Creating a New Plan

**With Copilot:**
> "Let's make a plan" or "Create a new plan"

**Manually:**
1. Copy `../TEMPLATE.md`
2. Name file with kebab-case based on title
3. Fill out all frontmatter fields
4. Write clear problem statement and success criteria
5. Save to this directory (or epic subdirectory)

---

## Priority Guidelines

- **High:** Blocking other work, critical bug, or time-sensitive
- **Medium:** Important but not urgent, can be scheduled
- **Low:** Nice to have, can be deferred

---

## Scope Guidelines

- **Small:** Hours of work, single focused change
- **Medium:** Days of work, moderate complexity
- **Large:** Weeks of work, consider breaking into epic with smaller plans
