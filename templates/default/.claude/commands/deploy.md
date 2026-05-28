---
description: Run pre-deploy checklist before shipping
---

Prepare this branch for deployment.

Run in order:
1. `npm run lint` — fix any errors before continuing
2. `npm test` — all tests must pass
3. `npm run build` — build must succeed
4. Summarize what's being deployed and flag anything risky

Do not proceed past any failing step. Report the failure clearly.
