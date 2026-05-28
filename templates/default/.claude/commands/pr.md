---
description: Create a pull request for the current branch
---

Create a pull request for the current branch.

## Steps
1. Run `git log main..HEAD` — understand what commits are included
2. Run `git diff main..HEAD` — read all the changes
3. Draft a PR title (under 70 characters, imperative mood)
4. Write a PR body with:
   - **What** changed and **why**
   - Any important implementation decisions
   - How to test it manually
5. Run `gh pr create` with the title and body

## PR title rules
- Imperative mood: "Add X", "Fix Y", "Remove Z"
- Under 70 characters
- No issue numbers in the title (put them in the body)

## PR body format
```
## What
[1-3 sentences on what changed]

## Why
[The motivation — bug, feature request, tech debt]

## Test plan
- [ ] [Manual step to verify it works]
- [ ] [Edge case to check]
```

## What NOT to do
- No AI attribution in the PR body
- No listing every file changed
- No "as per your request" or similar filler
