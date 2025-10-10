# Test Claude Code Review Workflow

This is a test file to verify the Claude Code Review GitHub Actions workflow is working correctly after fixing the permissions issue.

## Expected Behavior

When this PR is opened, the Claude Code Review workflow should:
1. Successfully authenticate with the GitHub API
2. Check the PR author's permissions
3. Review the PR changes
4. Post a review comment on the PR

## Previous Issue

The workflow was failing with:
```
GET /repos/.../collaborators/.../permission - 401
Error: Bad credentials
```

## Fix Applied

Updated `.github/workflows/claude-code-review.yml` permissions:
- `pull-requests: write` (was: read)
- `issues: write` (was: read)

## Test Validation

If you see a review comment from `claude[bot]` on this PR, the workflow is working correctly!

---

This file can be deleted after the test is complete.
