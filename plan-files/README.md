# Plan Files

A structured, plan-first development workflow for working with AI assistants.

---

## What Are Plan Files?

Plan files are markdown documents that define a unit of work before implementation begins. They provide:
- Clear goals and success criteria
- Context for AI assistants to help effectively
- A record of decisions and progress
- Traceability from planning through completion

---

## Directory Structure

```
plan-files/
├── README.md                    # This file
├── TEMPLATE.md                  # Template for new plans
├── to-do/                       # Pending plans (status: pending)
│   ├── [epic-name]/            # Plans grouped by epic
│   └── standalone-plan.md      # Individual plans
├── in-progress/                 # Active work (status: in-progress)
│   └── current-plan.md
└── completed/                   # Finished plans (status: completed)
    └── done-plan.md
```

---

## Creating a Plan

### When to Create a Plan

Create a plan file before starting any:
- New feature development
- Bug fixes that require investigation
- Experiments or proof-of-concepts
- Refactoring work
- Documentation updates

### How to Create a Plan

**With Copilot:** Say "let's make a plan" or "create a new plan"

**Manually:**
1. Copy `TEMPLATE.md` to `to-do/` directory
2. Rename with kebab-case based on title
3. Fill out all frontmatter fields
4. Write clear problem statement and success criteria
5. Set status to `pending`

### Plan File Requirements

Every plan must have:
- **Frontmatter:** All metadata fields completed
- **Problem/Goal:** Clear description of what you're solving
- **Success Criteria:** Specific, measurable outcomes (checkboxes)
- **Context Manifest:** Links, decisions, dependencies
- **Work Log:** Updated as work progresses

---

## Working with Plans

### Starting a Plan

**With Copilot:** Say "start working on [plan-name]"

**What happens:**
1. Plan moves from `to-do/` → `in-progress/`
2. Status changes to `in-progress`
3. Git workflow — Choose one:
   - **Traditional:** `git checkout -b <branch-name>`
   - **Worktree:** `git worktree add <worktree-dir>/<plan-name> <branch-name>`
4. Initial commit includes plan file

### During Active Work

- Check off success criteria as completed
- Update work log regularly (date entries)
- Add context as you discover it
- Commit logical units of work
- Keep plan file as single source of truth

### Pausing Work

**With Copilot:** Say "create a stop point"

**What to include:**
- Summary of work completed this session
- Current state and next steps
- Any blockers or questions
- Commit with updated plan file

### Completing a Plan

**With Copilot:** Say "this plan is complete"

**Checklist:**
- ✅ All success criteria met
- ✅ Tests passing (for changed code)
- ✅ Work log updated with final notes
- ✅ Status set to `completed`
- ✅ Branch ready for PR

**Note:** Plan stays in `in-progress/` until PR merges, then auto-moves to `completed/`

---

## Organizing with Epics

### What is an Epic?

An epic is a collection of related plans working toward a larger goal.

### When to Use Epics

Use epics when:
- Work naturally breaks into multiple plans
- Plans share common context or dependencies
- You want to track progress on a larger initiative

### Epic Structure

```
plan-files/to-do/
└── user-authentication/        # Epic directory
    ├── add-login-endpoint.md
    ├── add-jwt-tokens.md
    └── add-password-reset.md
```

Each plan in the epic sets `epic: user-authentication` in frontmatter.

---

## Best Practices

### Writing Good Plans

✅ **Be specific:** "Add POST /auth/login endpoint" not "Add auth"
✅ **Define done:** Use measurable success criteria
✅ **Right-size scope:** Small (hours), Medium (days), Large (weeks)
✅ **Include context:** Links, decisions, dependencies
✅ **Update frequently:** Keep work log current

### Working with Copilot

✅ **Start conversations with:** "check plans" to see current status
✅ **Be explicit:** "start working on add-login-endpoint"
✅ **Confirm completeness:** Review success criteria before finishing
✅ **Create stop points:** Help Copilot resume work later

### Git Workflow

✅ **One plan = one branch:** Use branch name from frontmatter
✅ **Choose your mode:** Traditional branches OR git worktrees (if configured)
✅ **Commit plan changes:** Keep plan file in sync with code
✅ **Link issues:** Add "Closes #123" in final commit if applicable
✅ **Squash before PR:** Use clean commit message (see final_squashed_commit_template.md)
✅ **Cleanup worktrees:** Run `git worktree remove <path>` after PR merges (if using worktrees)

**Traditional Branch Mode:**
```bash
git checkout -b feature/add-authentication
# Work in main repository
```

**Worktree Mode (Optional):**
```bash
git worktree add ../worktrees/add-authentication feature/add-authentication
# Work in isolated directory with its own plan-files/
# After PR merges: git worktree remove ../worktrees/add-authentication
```

**Note:** Enable worktree mode by running `material-plan-files --use-worktrees=../worktrees`

---

## GitHub Integration

### Creating Issues

After creating a plan, you can create a GitHub issue:
- Copilot will offer to create issue automatically
- Issue number goes in plan frontmatter
- Link plan in issue description for traceability

### Automated Workflows

If `.github/workflows/move-completed-plans.yml` exists:
- Completed plans auto-move to `completed/` when PR merges
- Keeps directories clean without manual work

---

## FAQ

**Q: Do I need a plan for every commit?**
A: No, plans represent units of work, not individual commits. One plan may have many commits.

**Q: Can I update a plan after starting work?**
A: Yes! Plans evolve. Update success criteria, add context, or adjust scope as you learn.

**Q: What if I need to pause work for weeks?**
A: Create a detailed stop point with next steps. This helps anyone (including future you) resume work.

**Q: Should I delete old completed plans?**
A: No. Completed plans are documentation of decisions and history. Keep them.

**Q: Can I work on multiple plans at once?**
A: Yes! Use separate branches (traditional mode) or separate worktrees. Worktrees are great for context switching without losing work-in-progress state.

**Q: What's the difference between branches and worktrees?**
A: Traditional branches require switching context in one directory. Worktrees let you have multiple branches checked out simultaneously in different directories, each with its own isolated plan-files/ directory.

---

## Getting Help

- Read `.github/instructions/plan-files.instructions.md` for Copilot-specific rules
- Check `TEMPLATE.md` for plan structure reference
- Ask Copilot: "how do I work with plan files?"
