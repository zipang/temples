# Spec: [T0006] Per-instance initial state

## Objective

Every `TemplesComponent` instance must own its `state`. Today a subclass passes a
module-level `INITIAL_STATE` constant to `super()`, and `reactive()` caches one proxy per
target object in a `WeakMap`. Because every instance passes the **same object**, every
instance receives the **same proxy** and therefore the **same `state`**.

**Goal:** copy the initial state in the `TemplesComponent` constructor before making it
reactive, so two instances never share one `state`.

**Users:** component authors who follow the documented "declare the initial state as a
constant" practice and render several instances of one class.

**Why now:** T0005's `icon-button` demo — two `<icon-button>` instances share `title` and
`action`, so the Save button reports `action: "remove"`. A two-item shopping list renders
the same label twice ("Bread", "Bread").

**Success criteria:**
- Two instances of a class that passes one `INITIAL_STATE` constant keep separate state.
- The documented `INITIAL_STATE` pattern works for components with flat state.
- A regression test fails on the old constructor and passes on the new one.

## Tech Stack

- Bun (runtime, test runner), TypeScript (strict)
- Biome (format + lint)
- Test DOM from `test/setup.ts` (linkedom globals)
- No new dependencies

## Commands

```
Install:    bun install
Test:       bun test packages/components
Check:      bun run check
Typecheck:  bun run typecheck
```

## Project Structure

Files touched by this ticket:

```
packages/components/src/component.ts        constructor copies the initial state
packages/components/src/component.test.ts   two-instance isolation regression test
packages/docs/content/components.md         nested-state caveat on the INITIAL_STATE advice
```

## Code Style

Arrow functions, JSDoc on every function, blank line before tests. The constructor change
stays a one-liner: `reactive({ ...state })`.

## Testing Strategy

- Unit test in `packages/components`: define a component that passes a shared
  `INITIAL_STATE`, create two instances with different observed attributes, assert each
  renders its own value.
- Prove-It: the test must fail against `reactive(state)` before the fix.

## Boundaries

- Always: run `bun run check` and `bun run typecheck`; keep the copy shallow and documented.
- Ask first: changing the state model or `reactive()` semantics.
- Never: deep-clone state in the constructor (it would strip methods or drop intent), or
  remove the two-instance test.

## Success Criteria

- [ ] `reactive({ ...state })` replaces `reactive(state)` in the constructor.
- [ ] Two instances keep separate `state` (regression test passes).
- [ ] The regression test fails with `reactive(state)` (Prove-It).
- [ ] `components.md` states that nested objects and arrays must be created per instance.
- [ ] `bun run check` and `bun run typecheck` pass.

## Open Questions

- Deep per-instance state (arrays and nested objects) stays out of scope: the copy is
  shallow, and a shared constant must not hold mutable containers. A state factory is the
  future option, if the need appears.
