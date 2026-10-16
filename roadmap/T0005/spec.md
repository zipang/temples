# Spec: [T0005] Proper `<slot>` support for web components

## Objective

`@temples/components` Light DOM components do not project authored children into
`<slot>` elements. `rerender()` appends the host's children after the template nodes, so a
`<slot>` stays empty and inert; children end up as siblings of the template root.

**Goal:** Distribute the host's authored children into the matching `<slot>` elements
(named and default) before the result is moved back into the host. Handle fallback content
and leftover (unmatched) children.

**Users:** developers building wrapper/shell components (header bar, card, panel) with
`@temples/components`; SSR consumers in `@temples/ssr`.

**Why now:** Issue #1. Blocks the wrapper shape entirely; children render outside component
markup. Silent failure (inert slot kept in output).

**Success criteria:** The repro from issue #1 produces
`<header class="docs-header"><a href="#">Brand</a><span>Tagline</span></header>` inside the
host, in both browser and SSR paths. Empty template `<slot></slot>` projects children into
the single slot without leaving an inert `<slot>`.

## Tech Stack

- Bun (runtime, test runner), TypeScript (strict)
- Biome (format + lint)
- linkedom DOM in `test/setup.ts`
- No new dependencies

## Commands

```
Install:    bun install
Test:       bun test
Focus:      bun test packages/components packages/ssr
Check:      bun run check
Typecheck:  bun run typecheck
```

## Project Structure

Files touched:

```
packages/components/src/component.ts        rerender() slot distribution
packages/components/src/component.test.ts   slot projection tests
packages/ssr/src/ssr.ts                    (if needed) slot handling in prepare
packages/ssr/src/ssr.test.ts               issue #1 repro test
```

## Code Style

Arrow functions, JSDoc on every function, blank line before tests/loops. Match existing
component.ts conventions. Slot distribution logic should be a small pure-ish helper for
testability.

## Testing Strategy

- Unit tests in `packages/components` for slot projection (default slot, named slots,
  fallback, leftover children, empty template).
- SSR test from issue #1 added to `packages/ssr/src/ssr.test.ts`.
- Existing tests must remain green.

## Boundaries

- Always: run `bun run check` and `bun run typecheck`; keep Light DOM (no shadow root).
- Ask first: changing component public API or adding dependencies.
- Never: edit `dist/` by hand; remove failing tests without approval.

## Success Criteria

- [ ] Repro output matches expected in issue #1 (browser path).
- [ ] Repro passes in SSR path with `removeDataBindings: false` and default.
- [ ] Default slot fallback content replaced when children provided.
- [ ] Named slots distribute `slot="name"` children.
- [ ] Leftover children appended after template when no slot.
- [ ] Empty template `<slot></slot>` projects children and removes inert slot.
- [ ] Slot content survives a re-render of the component and of any parent
  component (the renderer updates in place; it never detaches the subtree).
- [ ] `bun run check` and `bun run typecheck` pass.

## Open Questions

- Nested slots / slot re-projection across nested components: probably out of scope (single level).
- SSR unwrap behavior: should slot element be removed entirely after distribution? Yes, consistent
  with issue expected.
- The `icon-button` demo exposed a shared-state bug (all instances of a class share one `state`).
  Fixed separately in [T0006](../T0006/spec.md).
