# Implementation Plan: Add recipes content to the @temples/components documentation

## Overview

Add one short recipe per classic problem under `content/recipes/`, and index each one from the
"Recipes and good practices" chapter of `components.md`. The build already renders recipe pages,
exports their markdown, and lists them in `llms.txt`, so a recipe is a content-only change: write
the file, index it, verify it in the browser.

## Architecture Decisions

- **One problem per file.** A human or an agent loads only the recipe it needs, so context stays
  small.
- **One shape per recipe.** Problem, Solution, Why it works, Pitfalls. A reader learns the pattern,
  not just the code.
- **One domain for the set.** The recipes use a small cart (`cart-item`, `cart-list`, `cart-app`),
  consistent with the `messages` recipe. The example app in the repository is the fuller reference.
- **The guide stays the path; a recipe stays the detail.** The guide explains the model. A recipe
  shows one solution.

## Recipe set

| # | Slug | Title | Order |
|---|------|-------|-------|
| 0 | `messages` | How to send messages | 10 (done) |
| 1 | `reusable-child` | A reusable child that publishes an intent | 11 |
| 2 | `parent-list` | Render a list of child components | 12 |
| 3 | `share-a-change` | Share a change with the whole app | 13 |
| 4 | `handle-input` | Handle a form input | 14 |
| 5 | `edit-mode` | Toggle a read/edit mode | 15 |
| 6 | `app-config` | Share app-wide configuration | 16 |
| 7 | `payload-guard` | Narrow a message payload | 17 |
| 8 | `connect-hook` | Run code when the component connects | 18 |

Each recipe answers one question:

1. `reusable-child` — how does a generic child tell its owner what the user asked for?
2. `parent-list` — how does a parent render one child component per item?
3. `share-a-change` — how does a component tell another component it does not know?
4. `handle-input` — how does a component read a form value and commit it?
5. `edit-mode` — how does a component switch between a read and an edit view?
6. `app-config` — how does an app share one configuration value with every component?
7. `payload-guard` — how does a handler narrow the `unknown` message payload?
8. `connect-hook` — how does a component run code when it connects?

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

- [ ] `reusable-child`
- [ ] `parent-list`
- [ ] `share-a-change`
- [ ] `handle-input`
- [ ] `edit-mode`
- [ ] `app-config`
- [ ] `payload-guard`
- [ ] `connect-hook`

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

- Do we need a `slots` recipe? The guide shows slots in full. Add it only if a reader asks.
- Do we need a leaf-widget recipe? The guide's `flipping-card` walkthrough already covers it.
