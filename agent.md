# Agent Instructions

When making changes in this repository, increase the project version number.

Choose the version increment based on the size and impact of the change:

- Patch version for small fixes, documentation updates, internal refactors, or changes that do not alter expected behavior.
- Minor version for backward-compatible feature additions or meaningful behavior improvements.
- Major version for breaking changes, removed functionality, or changes that require users to adjust their setup or usage.

## Recurring Environment Issues

- `npm` is broken in this environment because `npm-cli.js` is missing under the global npm install. Do not rely on `npm test`, `npm run ...`, or `npx` here. For Vitest, run the local binary directly from `node_modules`, for example: `node .\node_modules\vitest\vitest.mjs run`.
- This project is now a Git repository. Use `git status`, `git diff`, and other Git metadata when checking the workspace, while preserving any unrelated user changes.
