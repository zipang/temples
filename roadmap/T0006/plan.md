# Implementation Plan: [T0006] Per-instance initial state

## Overview

Stop instances of one component class from sharing a single `state` object. The constructor
copies the initial state before wrapping it with `reactive()`, and a regression test guards
the behaviour.

## Architecture Decisions

- Fix in the base class, not in each subclass: the bug is in `TemplesComponent`, and every
  subclass that passes the documented `INITIAL_STATE` constant is affected.
- The copy is shallow (`{ ...state }`). A deep clone would drop functions and surprise
  authors; nested mutable state must be created per instance instead.
- The fix belongs to its own ticket (T0006) so T0005 stays focused on slot support.

## Task List

### Phase 1: Fix

- [x] **Task 1: Copy the initial state before making it reactive**
  - Acceptance: `constructor` uses `reactive({ ...state })`; the JSDoc documents the
    shallow copy and the nested-state caveat.
  - Verify: `bun test packages/components`, `bun run typecheck`
  - Files: `packages/components/src/component.ts`
  - Depends: None

- [x] **Task 2: Add the two-instance isolation regression test**
  - Acceptance: a component passing one `INITIAL_STATE` constant renders each instance's
    own observed attribute value.
  - Verify: `bun test packages/components`; Prove-It — the test fails against
    `reactive(state)`.
  - Files: `packages/components/src/component.test.ts`
  - Depends: Task 1

- [x] **Task 3: Document the nested-state caveat**
  - Acceptance: `components.md` states that `INITIAL_STATE` covers flat state and that
    nested objects and arrays must be created per instance.
  - Verify: `bun run build:docs`
  - Files: `packages/docs/content/components.md`
  - Depends: Task 1

### Checkpoint: Complete
- [x] `bun run check`, `bun run typecheck`, `bun test` pass.
- [x] The two-instance regression test fails on the pre-fix constructor.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Spread drops a non-enumerable state value | Low | State is a plain object literal in every documented case |
| Authors keep mutable nested state in a shared constant | Medium | Document the caveat in `components.md` |
| Existing tests rely on shared state | Low | Full suite run before completion; none do |

## Open Questions

- A state factory (`super(() => ({ items: [] }))`) would give deep isolation. Out of scope
  until a real need appears.
