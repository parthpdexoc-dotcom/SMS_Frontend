<!-- Beginning of Plan File Instructions -->
<!-- You generally should not edit this content -->
## IMPORTANT: Plan File Workflow ##

We use a plan-first development workflow. All work is tracked through plan files in the plan-files/ directory.

### Core Rules ###
- ✅ **ALWAYS** use `view` and `glob` for file system exploration (never bash)
- ✅ **ALWAYS** confirm with developer before making git changes
- ✅ **ALWAYS** use branch name from plan file frontmatter
- ✅ **PREFER** using `gh` CLI for GitHub interactions
- ❌ **NEVER** commit to main or master branch
- ❌ **NEVER** delete a plan file
- ❌ **NEVER** make changes outside plan scope without explicit permission

---

## Workflow Triggers

### When User Initiates Conversation

**STEP 1:** Read plan-files/README.md to understand workflow structure

**STEP 2:** Check for active plans
- View plan-files/in-progress/ for current work
- View plan-files/to-do/ for pending plans

**STEP 3:** Summarize status to developer
- List active plans with: priority, scope, epic (from frontmatter)
- IF no plans exist → Ask if they want to create one

---

### When User Says "Make a New Plan" or "Create a Plan"

**STEP 1:** Read templates for structure
- View plan-files/TEMPLATE.md for plan structure
- Reference .github/instructions/plan-files.instructions.md for detailed rules

**STEP 2:** Gather requirements from developer
- Get plan description and goals
- Confirm: priority (High/Medium/Low)
- Confirm: scope (Small/Medium/Large)
- Confirm: epic name (or NA if standalone)

**STEP 3:** Create plan file
- Write to plan-files/to-do/[epic-name]/ (or plan-files/to-do/ if no epic)
- Use kebab-case filename based on title
- Set status: pending
- Add all frontmatter fields

**STEP 4:** Ask about GitHub issue
- Prompt: "Would you like me to create a GitHub issue for this plan?"
- IF yes → Use `gh issue create` and add issue number to frontmatter
- IF yes → Ask about assignment (@me or teammate)

---

### When User Says "Start Working on [Plan]" or "Begin [Plan]"

**STEP 1:** Locate and verify plan
- Find plan file in plan-files/to-do/
- Confirm this is the correct plan with developer

**STEP 2:** Move plan to in-progress
- Git move from to-do/ to in-progress/
- Update status: in-progress

**STEP 3:** Check for worktree configuration
- View .plan-files-config in project root
- IF config exists with `"use_worktrees": true` → Ask developer: "Would you like to use a worktree or traditional branch?"
- IF config doesn't exist → Follow traditional branch workflow

**STEP 3a: Traditional Branch Workflow**
- Checkout branch specified in plan frontmatter
- IF branch exists → Warn developer

**STEP 3b: Worktree Workflow**
- Read `worktree_dir` value from .plan-files-config
- Get plan name (kebab-case from plan title) and branch from plan frontmatter
- Tell developer to run: `git worktree add <worktree_dir>/<plan-name> <branch-name>`
  - Replace `<worktree_dir>` with the EXACT value from config
  - Replace `<plan-name>` with kebab-case plan name
  - Replace `<branch-name>` with branch from frontmatter
- Note: Each worktree has its own isolated plan-files/ directory

**STEP 4:** Verify clean state
- Check if plan file is the only changed file
- IF other changes exist → Ask developer how to handle them

**STEP 5:** Commit
- Stage plan file only
- Commit with message: "Start: [plan-name]"
- Confirm with developer before committing

---

### When User Says "Create a Stop Point" or "Pause Work"

**STEP 1:** Update plan file work log
- Add today's date entry
- Document work completed in this session
- Add context for resuming work later

**STEP 2:** Add next steps section
- Write clear, actionable next steps
- Include any blockers or questions

**STEP 3:** Commit changes
- Verify correct branch (matches plan frontmatter)
- IF in worktree → Check with: `git rev-parse --git-common-dir` (output is NOT `.git` means you're in a worktree)
- Confirm with developer
- Commit with descriptive message

---

### When User Says "Plan is Complete" or "Finish Plan"

**STEP 1:** Verify completion
- Check all success criteria are met
- Confirm with developer explicitly

**STEP 2:** Update plan file
- Add final work log entry with completion notes
- Update status: completed
- Document any important context or decisions

**STEP 3:** Prepare commit message
- IF plan has linked issue → Add "Closes #[issue-number]"
- IF no issue → Standard completion message

**STEP 4:** Commit changes
- Verify correct branch
- IF in worktree → Check with: `git rev-parse --git-common-dir` (output is NOT `.git` means you're in a worktree)
- Confirm with developer
- Commit with completion message

**STEP 5:** Inform about workflow automation
- IF .github/workflows/move-completed-plans.yml exists:
  → Tell developer: "Plan will auto-move to completed/ when PR merges"
- IF in worktree (check with `git rev-parse --git-common-dir`):
  → Read `worktree_dir` from .plan-files-config and current plan name
  → Remind developer: "After PR merges, run: git worktree remove <worktree_dir>/<plan-name>"
- IF workflow doesn't exist:
  → Ask: "Would you like me to move the plan to completed/ now?"

---

### After Final Commit (PR Preparation)

**STEP 1:** Offer to squash commits
- Ask: "Would you like me to squash commits into one clean commit for the PR?"

**STEP 2:** IF developer says yes:
- Perform interactive rebase for the commits related to the plan
- Use plan-files/final_squashed_commit_template.md as guide
- Write comprehensive commit message with:
  - What changed
  - Why it's important
  - QA steps
  - Closes #[issue] if applicable

**STEP 3:** Final check
- Ensure all tests pass
- Verify no unintended changes
- Confirm branch is ready for PR

---

## Quick Reference Commands

**Check plans:** "check plans" or "show active plans"
**Make plan:** "let's make a plan" or "create a new plan"
**Start plan:** "start working on [plan-name]"
**Pause work:** "create a stop point"
**Complete plan:** "this plan is complete"
**Squash commits:** "squash the commits"

<!-- End of Plan File Instructions -->
