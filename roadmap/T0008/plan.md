# Implementation Plan: Add recipes content to the @temples/components documentation

## Overview

Add one short recipe per classic problem under `content/recipes/`, and index each one from the
"Recipes and good practices" chapter of `components.md`. The build already renders recipe pages,
exports their markdown, and lists them in `llms.txt`, so a recipe is a content-only change: write
the file, index it, verify it in the browser.

## Architecture Decisions

- **One problem per file.** A human or an agent loads only the recipe it needs, so context stays
  small.
- **A title names the problem, not the mechanism.** A reader searches for the task ("let a child
  tell its parent"), not our words ("publishes an intent"). Write every title as the question a
  developer asks.
- **One shape per recipe.** Problem, Solution, Why it works, Pitfalls. A reader learns the pattern,
  not just the code.
- **One domain for the set.** The recipes use a small cart (`cart-item`, `cart-list`, `cart-app`),
  consistent with the `messages` recipe. The example app in the repository is the fuller reference.
- **The guide stays the index; a recipe stays the detail.** `components.md` keeps the API and one
  pointer per concept. The recipe holds the explanation. When a recipe takes over a concept,
  remove that concept from the guide.
- **A recipe earns its place.** Write one only when the combination is not obvious. If the guide
  already shows the mechanism (attributes, state, `class[...]`, slots), do not repeat it.

## Recipe set

| # | Slug | Title (the problem) | Order |
|---|------|---------------------|-------|
| 0 | `messages` | Communicate between loose components with a message bus | 10 (done) |
| 1 | `list-of-children` | Render a list of children and let each one talk to the parent | 11 |
| 2 | `share-state` | Share a value between components that do not know each other | 12 |
| 3 | `form-input` | Read a form field and commit its value | 13 |
| 4 | `async-states` | Show loading, empty, and error states | 14 |
| 5 | `lifecycle` | Run code on connect and clean up on disconnect | 15 |

Each recipe answers one question:

1. `list-of-children` — how does a parent render one child per item, and how does each child tell
   the parent what the user asked?
2. `share-state` — how do components that do not know each other share one value?
3. `form-input` — how does a component read a field and commit its value?
4. `async-states` — how does a component show loading, empty, and error?
5. `lifecycle` — how does a component run code on connect and clean up on disconnect?

### Changes from the first draft

- `reusable-child` and `parent-list` merge into `list-of-children`. A list of children that each
  signal the parent is one code path, and it is the shape people build.
- `share-a-change` and `app-config` merge into `share-state`.
- `connect-hook` becomes `lifecycle`, and covers the disconnect cleanup too.
- `payload-guard` becomes a section of `messages`. Narrowing a payload is a TypeScript concern,
  not a component task.
- `edit-mode` drops. It is a narrow case of a state toggle.

## Task List

### Phase 1: One recipe at a time

For each recipe, run the same four steps. Focus only on the content of the current recipe.

- [ ] **Propose the content.** Present the full markdown in the question tool. The author approves
  it or requests a change.
- [ ] **Write the file.** `content/recipes/<slug>.md`, four-part shape, under about 80 lines.
- [ ] **Index it.** Add one line to the "Recipes and good practices" chapter of `components.md`.
- [ ] **Verify it.** `bun run build:docs`; open the recipe with `bun run serve:docs`; check the page
  is styled, its shell links resolve, `llms.txt` lists it, and the sidebar does not.

Recipe tasks:

- [ ] `list-of-children`
- [ ] `share-state`
- [ ] `form-input`
- [ ] `async-states`
- [ ] `lifecycle`

### Checkpoint: Complete

- [ ] Every recipe is written and indexed.
- [ ] `bun run check`, `bun run typecheck`, and `bun test` pass.
- [ ] `bun run build:docs` builds every recipe.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| A recipe grows past one problem | Medium | Split it, or link to the recipe that owns the other problem. |
| A recipe repeats the guide | Low | The guide explains the model. A recipe shows one solution. |
| A recipe drifts from the example app | Medium | Reuse the example app's names and code. |
| A recipe links a page that does not exist yet | Low | Write the linked recipe first, or drop the link until it exists. |

## Open Questions

- Do we need a `slots` recipe (a card or a shell)? The guide shows slots in full. Add it only if a
  reader asks.
- Do we need a recipe for a display value or a state class? The guide's `class[...]` section
  already covers it.
- Where does the payload guard live? Today it is a section of `messages`. Move it out only if it
  grows.
