# Code Style

<!-- Customize these rules to match your project -->

## General
- Prefer explicit variable names over short ones
- No magic numbers — use named constants
- Max function length: ~40 lines. If longer, split it.
- Delete dead code instead of commenting it out

## TypeScript / JavaScript
- `const` over `let`, never `var`
- Arrow functions for callbacks
- Async/await over `.then()` chains
- No `any` types without a comment explaining why

## Python
- Type hints on all function signatures
- f-strings over `.format()` or `%`
- `pathlib` over `os.path`

## CSS
- BEM naming for class names
- Variables in `:root` for all colors and spacing tokens
- Mobile-first media queries
