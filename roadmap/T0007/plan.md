# Implementation Plan: [T0007] Author-chosen message channels and event bubbling

## Overview

Rewrite the routing of `TemplesComponent` around one rule: a routed event walks the
component tree from the inside out, like the DOM. DOM events walk the component ancestors
of the event target. Messages walk the component ancestors of the emitter, then the
decoupled subscribers of the message bus. In both walks, the native
`event.stopPropagation()` stops delivery. The message channel name becomes the author's
choice, so the tag prefix disappears.

## Architecture Decisions

- **One walk for DOM events and one walk for messages.** Both iterate components from the
  nearest to the outermost and stop on `cancelBubble`. The walks share the idea, not the
  code, because their candidate sets differ (event target vs emitter).
- **Reuse the native `CustomEvent` flags.** `stopPropagation()` sets `cancelBubble` in the
  browser and in linkedom. The framework reads `event.cancelBubble` after each handler and
  stops. No new propagation API.
- **Keep the message bus.** Decoupled components still subscribe by channel name. Bubbling
  is an ordering rule on top: ancestor subscribers first, decoupled subscribers last. The
  change is backward compatible: a message with no ancestor subscriber still reaches every
  decoupled subscriber.
- **Remove the tag prefix in the framework.** The author writes the channel. Collisions
  become the author's responsibility, which is the goal: a channel groups a domain family.
- **One subscription, one delivery.** A subscription is delivered once per emit. The
  ancestor walk and the bus walk partition the subscription set, so no handler runs twice.
- **Inert template content does not receive messages.** Every class template lives in the
  document head, and the test DOM (linkedom) connects the instances parsed for it. A real
  browser keeps the content inert. A small guard treats a component inside a `<template>` as
  inert, so the parsed instances never receive a message. Without the guard, the parsed
  `shopping-item` and `icon-button` instances stay subscribed and answer a message twice.

## Task List

### Phase 1: Framework

- [x] **Task 1: Author-chosen message channels**
  - Acceptance: `emit(name, detail)` publishes on `name`, verbatim. JSDoc states the
    convention `family:action`.
  - Verify: `bun test packages/components`, `bun run typecheck`
  - Files: `packages/components/src/component.ts`
  - Depends: None

- [x] **Task 2: Message bubbling and stopPropagation**
  - Acceptance: `dispatchMessage` orders the subscribers (ancestors nearest first, then
    decoupled), and stops on `event.cancelBubble`.
  - Verify: `bun test packages/components`
  - Files: `packages/components/src/component.ts`
  - Depends: Task 1

- [x] **Task 3: DOM event bubbling across components**
  - Acceptance: `dispatch` walks every component ancestor of the event target and stops on
    `event.cancelBubble`.
  - Verify: `bun test packages/components`
  - Files: `packages/components/src/component.ts`
  - Depends: None

- [x] **Task 4: Routing tests**
  - Acceptance: tests cover channel naming, ancestor-first order, message stop, DOM
    bubbling, and DOM stop. The old "ignores outer handlers" test becomes the bubbling test.
  - Verify: `bun test packages/components`
  - Files: `packages/components/src/component.test.ts`
  - Depends: Tasks 1-3

### Phase 2: Example

- [x] **Task 5: Adopt the routing model in the shopping app**
  - Acceptance: intent messages (`shopping-item:save`, `shopping-item:remove`,
    `shopping-vault:recall`) and change messages (`shopping-item:updated`,
    `shopping-item:removed`, `shopping-vault:recalled`). No `source` filter. `vaultItems`
    is created per instance.
  - Verify: `bun demo` (manual), `bun run typecheck`
  - Files: `example/components/**`
  - Depends: Tasks 1-4

### Phase 3: Documentation

- [x] **Task 6: Guide and reference**
  - Acceptance: `components.md` documents channel naming, bubbling, `stopPropagation`, and
    the good practices for intent and change messages. `api-reference.md` matches `emit`.
  - Verify: `bun run build:docs`
  - Files: `packages/docs/content/components.md`, `packages/docs/content/api-reference.md`
  - Depends: Tasks 1-4

- [x] **Task 7: Glossary and example README**
  - Acceptance: the root `README.md` gains a `## Glossary` with `DOM event`, `Message`, and
    `Message bus`, sorted. `example/README.md` describes the real example in Simplified
    Technical English.
  - Verify: review
  - Files: `README.md`, `example/README.md`
  - Depends: Task 6

### Checkpoint: Complete

- [x] `bun run check`, `bun run typecheck`, and `bun test` pass.
- [x] `bun run build:docs` regenerates `www/` without error.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| An outer component handles an inner component's DOM event | Medium | This is the requested behavior. Document the selector scope, and stop with `stopPropagation()` where needed. |
| Authors stop propagation too early | Medium | Document the default: bubble to the owner, then the bus. Stop only to keep an event local. |
| Existing tests assert the old closest-only DOM rule | Low | Update that test to assert bubbling, and keep its intent. |
| `cancelBubble` unsupported by a DOM implementation | Low | Verified in the browser and linkedom. Read the flag after each handler. |

## Open Questions

- Should a message stop at the first ancestor handler by default, without `stopPropagation()`?
  No. The author controls the walk, consistent with the DOM.
