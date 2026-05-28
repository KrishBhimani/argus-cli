# Testing

## Rules
- Every bug fix needs a test that would have caught it
- Test behavior, not implementation details
- One assertion per test where possible
- Test names describe the scenario: `it('returns null when user not found')`

## Structure
- Unit tests live next to the code: `foo.ts` → `foo.test.ts`
- Integration tests in `tests/integration/`
- No mocking internal modules — only mock at system boundaries (HTTP, DB, filesystem)

## Commands
```bash
npm test              # run all tests
npm test -- --watch   # watch mode
npm test -- --coverage
```
