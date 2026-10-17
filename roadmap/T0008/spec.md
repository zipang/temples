# Spec: Add recipes content to the @temples/components documentation

## Objective

Improve the `@temples/components` documentation. The guide explains the component model, but it
has no worked recipe for the classic problems. Add short recipes, one problem per recipe.

A recipe is a small markdown file under `content/recipes/`. A human reads it in the browser. An
agent fetches its markdown twin on demand. The "Recipes and good practices" chapter of
`components.md` indexes every recipe.

**Goal:** cover the classic component problems with copy-paste recipes, each one problem only.

**Users:** component authors, and AI agents that read the markdown exports.

**Why now:** a reader who wants "a list of children", "a child that reports a change", or "a
component that reacts to a change it does not own" has no complete example to copy.

**Success criteria:**

- Every recipe is a short page under `content/recipes/`.
- Every recipe follows one shape: Problem, Solution, Why it works, Pitfalls.
- The components page indexes every recipe.
- `llms.txt` lists every recipe, and the sidebar does not.
- `bun run build:docs` builds each recipe, and its shell links resolve.

## Tech Stack

- Bun (runtime, test runner), TypeScript (strict)
- Biome (format + lint)
- The docs build (`packages/docs/src/build.ts`) already supports recipe pages

## Commands

```
Build:   bun run build:docs
Preview: bun run serve:docs
Check:   bun run check
Types:   bun run typecheck
Test:    bun test
```

## Project Structure

```
packages/docs/content/recipes/<slug>.md   one recipe per file
packages/docs/content/components.md       the "Recipes and good practices" chapter indexes them
```

## Code Style

Prose follows the technical-writing skill (Simplified Technical English): short sentences, active
voice, no contractions, no semicolons. Code follows the repository style: arrow functions, JSDoc on
every function, and a blank line before a test or a loop.

## Recipe shape

Every recipe is one page with four parts:

1. **Problem** — one or two sentences.
2. **Solution** — the full code, ready to copy.
3. **Why it works** — two or three bullets that tie back to the component model.
4. **Pitfalls** — the mistakes the recipe avoids.

Keep a recipe under about 80 lines. One problem per recipe.

## Testing Strategy

- Build the site with `bun run build:docs`.
- Open the recipe with `bun run serve:docs`, and check the page renders styled.
- Check the recipe is listed in `llms.txt` and absent from the sidebar.
- Check `bun run check`, `bun run typecheck`, and `bun test` pass.

## Boundaries

- Always: keep one problem per recipe, and update the index in `components.md`.
- Ask first: a new public API, or a change to the build.
- Never: edit `packages/docs/www/` by hand. Rebuild it.

## Success Criteria

- [ ] The recipe set in the plan is written and indexed.
- [ ] Every recipe follows the four-part shape.
- [ ] `bun run check`, `bun run typecheck`, and `bun test` pass.
- [ ] `bun run build:docs` builds every recipe.

## Open Questions

- Repeat a small code block, or link to the recipe that owns it? Repeat the small block. Link when
  the whole recipe is the answer.
- Does the set need a `slots` recipe? The guide shows slots in full. Add it only if a reader asks.
