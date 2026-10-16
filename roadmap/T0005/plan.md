# Implementation Plan: [T0005] Proper `<slot>` support for web components

## Overview
Add Light-DOM slot projection in `TemplesComponent.rerender()`: distribute authored host
children into matching `<slot>`/`<slot name="…">` elements, handle fallback content and
leftover children, and remove `<slot>` wrappers from output (SSR too).

## Architecture Decisions
- Slots handled during render distribution in component.ts (shared for browser + renderer).
- Named slot assignment via `slot="name"` attribute on authored children.
- Unmatched children appended after template when no default slot; fallback kept when slot empty.
- `<slot>` element itself removed from final output, replaced by projected children.

## Task List

### Phase 1: Foundation

- [x] **Task 1: Read component.ts rerender paths**
  - Acceptance: rerender, connectedCallback identified; container handling clear.
  - Verify: code review.
  - Files: packages/components/src/component.ts
  - Depends: None

### Checkpoint: Foundation
- [x] Understand flow.

### Phase 2: Core Features

- [x] **Task 2: Implement slot distribution in rerender()**
  - Acceptance: default slot projects children; named slots distribute slot="name";
    fallback retained only when no children; leftovers appended; `<slot>` removed from output.
  - Verify: bun test packages/components
  - Files: packages/components/src/component.ts
  - Depends: Task 1

- [x] **Task 3: Add component tests for slots**
  - Acceptance: tests for default, named, fallback, leftover, empty-template cases,
    plus slot content surviving a parent re-render.
  - Verify: bun test packages/components
  - Files: packages/components/src/component.test.ts
  - Depends: Task 2

- [x] **Task 3b: Render in place so projected content survives re-renders**
  - Acceptance: `rerender()` applies bindings without detaching the subtree; the
    authored children are captured once in `slotted` and projected by `projectSlots()`.
    A parent re-render no longer fires the nested components' `disconnectedCallback`,
    which discarded their projected children.
  - Verify: `bun test packages/components` (the "slot content survives a parent
    re-render" test fails on the detaching implementation).
  - Files: packages/components/src/component.ts
  - Depends: Task 2

### Checkpoint: Core
- [x] Component tests pass.

### Phase 3: SSR

- [x] **Task 4: SSR slot handling in prepare/render**
  - Acceptance: issue #1 repro (T0005) produces expected nested output both modes.
  - Verify: bun test packages/ssr
  - Files: packages/ssr/src/ssr.ts, packages/ssr/src/ssr.test.ts
  - Depends: Task 2

- [x] **Task 5: Add issue repro test**
  - Acceptance: new test added matching issue.
  - Verify: bun test packages/ssr
  - Files: packages/ssr/src/ssr.test.ts
  - Depends: Task 4

### Checkpoint: Complete
- [x] bun run check, bun run typecheck pass.

### Phase 4: Documentation and demo

- [x] **Task 6: Document slots in components.md**
  - Acceptance: `## Slots` section covers default slot, named slots (`slot="name"`),
    fallback content, leftover children, and the nested-slots limitation, with a
    wrapper example.
  - Verify: `bun run build:docs` renders the section.
  - Files: `packages/docs/content/components.md`
  - Depends: Task 2

- [x] **Task 7: Semantic docs layout**
  - Acceptance: replace `div.site`/`div.site-body` with `body` grid areas; `nav` and
    `main` are siblings; `main.content > article` holds `page.content`.
  - Verify: `bun run build:docs` and inspect `www/index.html`.
  - Files: `packages/docs/layout.html`, `packages/docs/assets/style.css`
  - Depends: None

- [x] **Task 8: Demo slot component (IconButton)**
  - Acceptance: new `icon-button` component with `title`, a `type` (native button type,
    `"submit"` inside a form), and an `action`, a click handler that emits the `action`
    as the **event name** (`icon-button:save`, `icon-button:remove`, `icon-button:recall`)
    and the host as `source`, plus a default `<slot>` for its SVG icon. The demo replaces
    every text button with an `icon-button` (add, save, remove, recall); `shopping-item`
    maps `icon-button:save`/`icon-button:remove` to handlers that ignore a message whose
    `source` is not inside it; the edit input saves on Enter as on the Save icon.
  - Verify: `bun demo`, then `bun test`, `bun run check`, `bun run typecheck`.
  - Files: `example/components/icon-button/*`, `example/components/shopping-item/*`,
    `example/components/shopping-app/*`, `example/components/shopping-vault/*`,
    `example/main.ts`
  - Depends: Task 2

### Checkpoint: Documentation and demo
- [x] Docs build renders the Slots section and the semantic layout.
- [x] The example app saves and removes items through `icon-button`.
- [x] All checks pass.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| SSR output shape differ | Med | Compare expected bytes exactly |
| Slot removal edge cases | Med | Tests |

## Open Questions
- None (nested slots out of scope).
