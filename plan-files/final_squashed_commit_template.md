# Final Squashed Commit Template

When squashing commits for a clean PR, use this template to write a comprehensive commit message.

---

## Commit Message Format

```
[Type]: [Brief Title]

What is this Change?
[Detailed description of what changed]

Why is this Change Important?
[Business value, problem solved, or goal achieved]

Additional Context
[Any relevant background, decisions, or tradeoffs]

QA Steps
[How to verify this change works correctly]

Closes #[issue-number]
```

---

## Commit Type Prefixes

- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code restructuring without behavior change
- `docs:` Documentation only
- `test:` Adding or updating tests
- `chore:` Maintenance tasks (dependencies, config, etc.)
- `perf:` Performance improvement
- `style:` Code style/formatting changes

---

## Example: Good Squashed Commit

```
feat: Add JWT authentication to API endpoints

What is this Change?
Implemented JWT-based authentication for the API. Added:
- POST /auth/login endpoint for username/password authentication
- JWT token generation with 24-hour expiration
- Middleware to validate JWT on protected endpoints
- Comprehensive test suite (8 tests, all passing)

Protected endpoints now require valid JWT in Authorization header.
Invalid or expired tokens return 401 with clear error messages.

Why is this Change Important?
Previously all API endpoints were public, creating a security risk.
This authentication layer ensures only authorized users can access
protected resources, meeting our security compliance requirements.

Additional Context
- Chose HS256 algorithm based on team discussion (vs RS256)
- Token expiration set to 24 hours per product requirements
- Refresh token support intentionally deferred to future work
- Added bcrypt for password hashing

Technical decisions:
- Used jsonwebtoken library for JWT handling
- Middleware pattern for authentication checks
- Environment variable for JWT secret

QA Steps
1. POST to /auth/login with valid credentials
   - Should return JWT token
2. Use token in Authorization header: "Bearer [token]"
   - Should access protected endpoints successfully
3. Try accessing protected endpoint without token
   - Should return 401 Unauthorized
4. Try with expired/invalid token
   - Should return 401 with descriptive error

Run test suite: npm test
All authentication tests should pass.

Closes #456
```

---

## Example: Minimal but Complete

```
fix: Handle null values in user profile endpoint

What is this Change?
Added null checking for optional profile fields (bio, avatar_url, location).
Endpoint now returns empty string instead of crashing when fields are null.

Why is this Change Important?
Users without complete profiles were unable to load their profile page,
causing 500 errors and support tickets. This fix allows profiles with
partial data to display correctly.

QA Steps
1. Create user with minimal profile (only required fields)
2. GET /api/users/:id
3. Verify response includes empty strings for optional fields
4. Verify no 500 errors in logs

Closes #789
```

---

## Tips for Writing Good Commit Messages

### Do ✅
- **Be specific:** Include actual changes made
- **Explain why:** Business value or problem solved
- **Include QA steps:** Make it easy to verify
- **Reference issues:** Always close related issues
- **Use imperative mood:** "Add feature" not "Added feature"

### Don't ❌
- **Be vague:** "Fixed stuff" or "Updated code"
- **Skip the why:** Reviewers need context
- **Forget QA steps:** How do we test this?
- **Leave out issue numbers:** Breaks traceability
- **Write a novel:** Be comprehensive but concise

---

## When to Squash Commits

Squash commits when:
- ✅ Multiple commits represent one logical change
- ✅ Commit history has "WIP" or "fix typo" commits
- ✅ You want clean, readable git history
- ✅ Preparing PR for merge to main branch

Don't squash when:
- ❌ Commits represent distinct, separate changes
- ❌ History shows valuable progression of thought
- ❌ Team prefers detailed commit history

---

## Squashing with Copilot

When you say "squash the commits," Copilot will:
1. Perform interactive rebase
2. Use this template to write commit message
3. Pull information from plan file work log
4. Include all relevant context and QA steps
5. Confirm with you before finalizing

---

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [How to Write a Git Commit Message](https://chris.beams.io/posts/git-commit/)
- Plan file work log (source of context for commit message)
