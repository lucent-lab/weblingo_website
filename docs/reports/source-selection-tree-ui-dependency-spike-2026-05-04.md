# Source Selection Tree UI Dependency Spike

Date: 2026-05-04
Repo: `weblingo_website`

## Decision

Keep the current custom source-selection projection and harden it as an ARIA `treegrid`. Do not add a tree dependency for M6.5.1.

## Context

The backend now owns source-selection truth through flat `sourceSelection.rules` plus read-only preview endpoints:

- `POST /api/sites/:siteId/source-selection/preview`
- `POST /api/sites/:siteId/source-selection/tree-preview`

The website editor must not persist checkbox cascade state, folder ids, or page-selection tables. Folder and page commands compile back to exact rules such as `/pricing` and subtree rules such as `/blog/*`.

## Options Reviewed

### Current Custom Projection

- React 19 compatibility: no new runtime dependency.
- Bundle impact: unchanged.
- Keyboard behavior: implemented directly with row focus, Up/Down/Home/End movement, parent movement with ArrowLeft, and folder open with ArrowRight/Enter/Space.
- Screen-reader semantics: table upgraded to `role="treegrid"` with column headers, row levels, row labels, and backend state text.
- Large-tree behavior: backend remains responsible for scoped child/search results and cursor pagination.
- Contract fit: strongest fit because backend preview remains the only selection authority.

### Headless Tree / COSS Tree Options

- React 19 compatibility: requires package-specific validation before adoption.
- Bundle impact: would add tree state management that the product must avoid persisting as policy truth.
- Keyboard behavior: useful if the product later needs fully expanded, virtualized, multi-select tree interaction.
- Contract fit: risk of introducing a second client selection model unless wrapped very narrowly around backend preview nodes.

### ReUI Radix/Base Tree Options

- React 19 compatibility: likely viable but still requires validation in this app.
- Bundle impact: additional primitives and styling work.
- Keyboard behavior: useful for hierarchical disclosure, less directly aligned with cursor-backed backend search results.
- Contract fit: acceptable only if selection state remains command-only and backend preview remains authoritative.

## Follow-Up Trigger For A Dependency

Revisit a dedicated tree package only if the source-selection editor needs persistent expanded-folder state, virtualization across thousands of simultaneously rendered nodes, or richer multi-row bulk commands. Any dependency must first prove React 19 support, license acceptability, bundle impact, keyboard/screen-reader behavior, and compatibility with backend-preview authority.
