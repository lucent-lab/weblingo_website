## Summary

- Why:
- What:

## Testing

- [ ] `corepack pnpm test`
- [ ] `corepack pnpm check`
- [ ] `corepack pnpm test:contracts`
- [ ] `WEBLINGO_REPO_PATH=/absolute/path/to/weblingo corepack pnpm docs:sync:check` (required when CI cross-repo token is unavailable)

## Docs sync and capability matrix

- [ ] Updated `docs/backend/DASHBOARD_SPECS.md` if user-facing backend capability coverage changed.
- [ ] Ran `WEBLINGO_REPO_PATH=/absolute/path/to/weblingo corepack pnpm docs:sync` and committed `content/docs/_generated/*` when backend HEAD advanced.
