# Spec: [T0007] Author-chosen message channels and event bubbling

## Objective

Change how `TemplesComponent` routes DOM events and messages. Today three limits push
authors into workarounds:

1. `emit(name)` publishes under the fully qualified name `<tag>:<name>`. The channel is
   keyed by the emitting component tag, so an author cannot group messages by domain family
   and two components cannot publish on one channel.
2. A message reaches **every** subscriber in the application. A nested child that wants to
   reach its owner must broadcast globally, and the owner must filter by the emitting
   element. The `icon-button` of the example app carries this exact workaround
   (`IconButtonAction.source` plus `owner.contains(source)`).
3. A DOM event stops at the closest component. A parent component cannot handle a DOM event
   that starts inside a nested child component, so a wrapper cannot catch its own child's
   clicks.

**Goal:** give authors one coherent routing model that behaves like the DOM.

- The author chooses the message channel. `emit("shopping-item:updated")` publishes on
  `shopping-item:updated`; the tag prefix disappears.
- A message bubbles up the component tree. The nearest subscribed ancestor handles it
  first, then each outer ancestor, then the decoupled subscribers of the message bus. A
  handler calls `stopPropagation()` to stop the walk.
- A DOM event bubbles up the component tree. The closest component handles it first, then
  each outer component, until a handler calls `stopPropagation()`.

**Users:** component authors. The change removes the global-broadcast workaround and lets
messages carry an application meaning, not a widget name.

**Why now:** the example app's `icon-button` shows the failure. Its `save`, `remove` and
`recall` actions broadcast to every instance of the owner class, and each owner filters the
events it does not own. The workaround is fragile and it reads in three files.

**Success criteria:**

- `emit` uses the channel name verbatim. Two components can publish on one channel.
- A message reaches the nearest subscribed ancestor before the decoupled subscribers.
- `event.stopPropagation()` stops message delivery to the outer ancestors and to the
  message bus.
- A DOM event reaches the closest component, then each outer component, until a handler
  calls `event.stopPropagation()`.
- The example app drops `IconButtonAction`, `isIconButtonAction`, and `isOwnIconButton`.

## Tech Stack

- Bun (runtime, test runner), TypeScript (strict)
- Biome (format + lint)
- Test DOM from `test/setup.ts` (linkedom globals)
- No new dependencies

## Commands

```
Install:    bun install
Test:       bun test
Focus:      bun test packages/components
Check:      bun run check
Typecheck:  bun run typecheck
Docs:       bun run build:docs
```

## Project Structure

Files touched by this ticket:

```
packages/components/src/component.ts        emit, dispatchMessage, DOM dispatch, helpers
packages/components/src/component.test.ts   channel, bubbling, and stopPropagation tests
packages/docs/content/components.md         messaging guide and good practices
packages/docs/content/api-reference.md      emit and event map reference
example/components/icon-button/index.ts     action is the full channel; no payload guard
example/components/shopping-app/index.ts    subscribe to full channel names
example/components/shopping-item/index.ts   intent messages; no source filter
example/components/shopping-vault/index.ts  intent message; per-instance vaultItems
example/components/*/*.html                 action attributes carry the full channel
README.md                                   glossary entries
example/README.md                           usage example description
```

## Code Style

Arrow functions, JSDoc on every function, blank line before tests and loops. The routing
helpers stay small and pure: one helper orders the message subscribers, one helper orders
the component ancestors of an event.

## Testing Strategy

- Message channels: an author-chosen channel delivers to its subscriber.
- Message bubbling: the nearest subscribed ancestor receives before the decoupled
  subscribers.
- Message stop: `stopPropagation()` in an ancestor handler prevents the outer ancestors and
  the decoupled subscribers.
- DOM bubbling: an outer component receives a click from a nested child; the closest
  component receives it first; `stopPropagation()` in the inner handler stops the outer one.
- Existing DOM and messaging tests must stay green, updated only where the old behavior was
  the subject of the test.

## Boundaries

- Always: run `bun run check` and `bun run typecheck`; keep the Light DOM (no shadow root).
- Ask first: a new public API member, or a change to the `events` map format.
- Never: edit `packages/docs/www/` by hand (rebuild it), or edit `packages/*/dist/` by hand.

## Success Criteria

- [x] `emit("family:action", detail)` publishes on `family:action`.
- [x] Two component classes publish on one channel and both reach the subscriber.
- [x] A message reaches the nearest subscribed ancestor, then the decoupled subscribers.
- [x] `stopPropagation()` stops the remaining message delivery.
- [x] A DOM event reaches the closest component and then the outer components.
- [x] `stopPropagation()` stops the remaining DOM delivery.
- [x] The example app uses intent messages and change messages, with no source filter.
- [x] `bun run check`, `bun run typecheck`, and `bun test` pass.

## Open Questions

- Should the framework reserve a channel naming format (`family:action`)? No. The author
  owns the name. The documentation states the convention only.
- Should the emitter receive its own message? Yes. The emitter is the first candidate in the
  ancestor chain, so a component can subscribe to a channel it publishes.
