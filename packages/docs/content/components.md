---
title: Web Components
description: Declarative Web Components with reactive state and event wiring.
order: 3
---

# TemplesComponent

`@temples/components` turns the engine into a Web Component system. 

## Install

```sh
bun add @temples/components
```

`@temples/engine` comes as a dependency.

## How to write a web component

1. Import `TemplesComponent`, the HTML template, and the stylesheet.
2. Declare the state interface, then declare the initial state as a constant.
3. Write the class: the constructor passes the initial state to `super()`, and the handler
   methods mutate `this.state`.
4. Register the component with `TemplesComponent.define()`.

The class carries the state and the handler methods. `define()` registers the web component
and sets the HTML template, the observed attributes, and the event bindings. The component
then renders its template, reacts to state changes, and wires its events — with no framework.

**Note:** with Bun, import the template as text with `with { type: "text" }`, and import the
stylesheet directly.

The example below builds a `flipping-card`. The recto shows a title, the verso shows a hidden
text, and a click on the card flips it. It follows the same approach as the `shopping-item`
component of the example app (`example/components/shopping-item/` in the repository).

```typescript
// flipping-card.ts
import { TemplesComponent } from "@temples/components";
import template from "./flipping-card.html" with { type: "text" };

import "./flipping-card.css";

/**
 * The complete state of the card: the observed attributes, plus the
 * `flipStatus()` helper that derives the state class for the template.
 */
interface FlippingCardState {
    title: string;
    verso: string;
    flipped: boolean;
    flipStatus(): string;
}

const INITIAL_STATE: FlippingCardState = {
    title: "",
    verso: "",
    flipped: false,
    flipStatus() {
        return this.flipped ? "flipped" : "";
    }
};

/**
 * A two-sided card. The recto shows the title, the verso shows the hidden
 * text. A click on the card toggles the visible face.
 */
export class FlippingCard extends TemplesComponent<FlippingCardState> {
    constructor() {
        super(INITIAL_STATE);
    }

    /**
     * Show the verso when the card shows the recto, and the other way round.
     */
    toggle(): void {
        this.state.flipped = !this.state.flipped;
    }
}

TemplesComponent.define("flipping-card", FlippingCard, {
    template,
    attributes: { title: "string", verso: "string", flipped: "boolean" },
    events: {
        "click .card-inner": "toggle"
    }
});
```

```html
<!-- flipping-card.html -->
<div class="card-inner" data-bind="class[flipped]=flipStatus">
    <div class="face recto">
        <h3 data-bind="title">A title</h3>
    </div>
    <div class="face verso">
        <p data-bind="verso">The hidden side</p>
    </div>
</div>
```

```css
/* flipping-card.css */
flipping-card {
    display: block;
    perspective: 1000px;

    .card-inner {
        display: grid;
        cursor: pointer;
        transform-style: preserve-3d;
        transition: transform 0.6s;

        &.flipped {
            transform: rotateY(180deg);
        }
    }

    .face {
        grid-area: 1 / 1;
        backface-visibility: hidden;
        padding: 1rem;

        &.verso {
            transform: rotateY(180deg);
        }
    }
}
```

```html
<!-- usage -->
<flipping-card title="Hello World" verso="Surprise!" flipped="false"></flipping-card>
```

### Good practice: declare the state interface

The state type lists every value the component holds: the observed attributes, plus the
internal values and helpers. Declare it as an `interface` (or a `type` alias) and pass it to
the `TemplesComponent<T>` parameter. TypeScript then checks the `super()` call and every
`state` access against the same shape.

### Good practice: declare the initial state as a constant

Build the defaults once, as a typed `INITIAL_STATE` constant, and pass it to `super()`.
The constructor stays a one-liner, the defaults live in one place, and TypeScript checks the
constant against the state interface. The defaults also cover the attributes that the tag does
not declare: `connectedCallback` only reads the attributes present on the tag.

The constructor copies the initial object before it becomes reactive, so the constant is safe
for a class with several instances: each instance gets its own `state`. The copy is **shallow**.
A nested object or array is still shared by reference, so keep nested mutable state out of the
constant: create it in the constructor, e.g. `super({ ...INITIAL_STATE, items: [] })`.

### Good practice: reflect the state with classes

Derive the state class names inside the state itself. A helper method returns the class name
when the state is active, and an empty string otherwise. The template binds it with
`data-bind="class[flipped]=flipStatus"`: the engine adds the class when the value belongs to
the `class[...]` range, and removes it otherwise. Handlers mutate `this.state` only — no
imperative `classList` calls, and the re-render follows automatically.

### Good practice: style the states with nested CSS

Scope every rule under the component tag name. Write the state classes as nested rules with
the `&` selector, next to the base styles of the same element. The state-driven styling then
reads in one place, and the class names match the template bindings.

### Define options

| Option | Role |
|--------|------|
| `template` | The HTML template string. Parsed once per class. Every instance clones it. |
| `attributes` | The observed attributes map. Each key names an attribute that flows into `state`. Each value is its coercion type: `"string"`, `"boolean"`, `"number"`, or `"json"`. |
| `events` | The event bindings map (see below). |
| `css` | Optional stylesheet text, injected when the component is used in SSR (see below). |
| `globalStore` | Optional shared store that seeds the attributes the tag does not set. |

The `attributes` map derives the class `observedAttributes` and `attributeTypes` statics, which
stay internal. A class that passes `attributes` and also declares those statics makes `define()`
throw.

## State: attributes are the source of truth

A component's data lives in `this.state`. The subclass passes its initial values to `super()`,
and the state becomes a deep reactive proxy at construction:

- Each name in the `attributes` map is read from the tag, coerced by its declared type, and
  written into `state`.
- Changing an attribute (`card.setAttribute("flipped", "true")`) updates `state` and re-renders.
- Mutating `state` (`this.state.flipped = true`) re-renders the component's bindings.

In TypeScript, the class declares its complete state shape with the `TemplesComponent<T>`
parameter, and the initial values live in an `INITIAL_STATE` constant — see the two first good
practices of the walkthrough above. The `super()` call and every `state` access are then
checked. Message payloads stay `unknown` at the bus boundary. Narrow them with a type guard
before use.
- The optional `globalStore` option seeds the attributes the tag does not set:
  `globalStore: { title: "Default" }` in the define call. An explicit attribute on the tag
  always wins over the store.

State mutation drives rendering: there is no separate `render()` call to remember.

## Events and messaging

The `events` option maps bindings to handler method names. Handlers run with `this` bound to the
component instance and receive the event, so they can call `preventDefault()`, read
`event.target.value`, and call other component methods directly.

A binding **with a space** is a DOM event: `"<eventType> <selector>"`. One shared document
listener per event type serves every component. The selector is matched inside the subtree of the
component that owns the binding.

```javascript
events: {
    "submit .add-form": "onAdd",
    "click .flip-btn": "flip",
},

onAdd(event) {
    event.preventDefault();
    // read event.target.value, mutate this.state, ...
}
```

A DOM event bubbles up the component tree, like a native DOM event. The closest component handles
it first, then each outer component. A parent can therefore handle an event that starts inside a
nested child component.

A binding **without a space** is a message channel: `"<family>:<action>"`. The author chooses the
name, so related messages share one channel and several components can publish on it:

```javascript
// shopping-item.js
this.emit("shopping-item:updated", { id: 1, label: "Milk" });

// shopping-app.js
events: {
    "shopping-item:updated": "onUpdated",
    "shopping-item:removed": "onRemoved",
},

onUpdated(event) {
    // event.detail carries the payload
}
```

A message bubbles too. The subscribers that are ancestors of the emitter receive it first, the
nearest one first. The remaining subscribers on the bus receive it last. A handler calls
`event.stopPropagation()` to stop the walk, so the outer ancestors and the bus receive nothing.

The `events` map is registered on connection and unsubscribed on disconnection. `this.on(map)`
adds runtime bindings the same way.

### Good practice: separate the intent from the change

A component that owns its data marks a local action and a shared change with two messages on one
family channel.

- The **intent** names the user action, for example `shopping-item:save` and
  `shopping-item:remove`. A reusable child, such as an icon button, publishes the intent. The
  owner is the nearest subscribed ancestor. It handles the intent and calls `stopPropagation()`,
  so the intent never reaches the other instances.
- The **change** names the result, for example `shopping-item:updated` and
  `shopping-item:removed`. The owner publishes the change after it updates its state. The owner
  does not stop a change that other components need.

Name a message handler `on<EventName>`, with the channel in PascalCase. For example,
`onShoppingItemUpdated` handles `shopping-item:updated`. The name tells a message handler apart
from a DOM handler at a glance.

A channel groups a domain family, not a component class. Two components can publish on one
channel.

## Styling

Components use the Light DOM — no Shadow DOM. Styles reach the component through a stylesheet
import (bundled by Bun), through the page's global styles, or through the `css` option for SSR.
Scope every rule by the component tag name, and style the component states with nested rules:

```css
flipping-card {
    perspective: 1000px;

    .card-inner {
        transition: transform 0.6s;

        &.flipped {
            transform: rotateY(180deg);
        }
    }
}
```

Do not select on the attribute (`flipping-card[flipped="true"]`). An attribute change flows
into `state`, but a state mutation does not write back to the attribute. A class bound with
`data-bind="class[...]"` always follows the state.

Light DOM keeps the component themeable with the page's CSS variables. Tag-name scoping keeps
the rules from leaking.

## Slots: content authored on the tag

A component can wrap the content the caller writes inside its tag. The template declares one or
more `<slot>` elements, and the children authored on the tag are **projected** into them. This is
the wrapper or shell shape: a header bar, a card, or a panel that lays out and styles content its
caller provides.

Components use the Light DOM, so there is no shadow tree and no native projection. The component
projects the children itself: after the template renders, each `<slot>` is replaced by the
matching children. Named slots use the `slot` attribute on the child and the `name` attribute on
the slot. A slot with no matching children keeps its own fallback content; children that match no
slot are appended after the template. The `<slot>` element never appears in the output.

```typescript
// site-header.ts
import { TemplesComponent } from "@temples/components";
import template from "./site-header.html" with { type: "text" };

export class SiteHeader extends TemplesComponent {
    constructor() {
        super({});
    }
}

TemplesComponent.define("site-header", SiteHeader, { template });
```

```html
<!-- site-header.html -->
<header class="site-header">
    <slot></slot>
</header>
```

```html
<!-- usage: the children land inside the template's header -->
<site-header>
    <a class="brand" href="index.html">@temples</a>
    <span class="tagline">templates you won't @</span>
</site-header>
```

The component renders to the children inside its own markup:

```html
<site-header>
    <header class="site-header">
        <a class="brand" href="index.html">@temples</a>
        <span class="tagline">templates you won't @</span>
    </header>
</site-header>
```

Named slots split the content into several regions. A child opts into a slot with `slot="name"`;
the template marks the region with `<slot name="name">`. Fallback content is the slot's own
children, kept when no child matches:

```html
<!-- panel.html -->
<section class="panel">
    <header><slot name="title">Untitled</slot></header>
    <slot></slot>
</section>
```

```html
<panel>
    <h2 slot="title">Settings</h2>
    <p>General options.</p>
</panel>
```

The `<h2>` fills `<slot name="title">`, the `<p>` fills the default `<slot>`. When no `slot="title"`
child is authored, the fallback `Untitled` stays. Children that match no slot are appended after
the template instead of being dropped.

Nested slots — a slot inside a projected child — are not distributed.

## Lifecycle

`TemplesComponent` implements the standard custom element lifecycle:

| Hook | Behavior |
|------|----------|
| `connectedCallback` | Clones the template into the component, seeds `state` from the attributes and the global store, registers the `events` map, renders. |
| `disconnectedCallback` | Unsubscribes events and the state subscription. |
| `attributeChangedCallback` | Coerces the attribute into `state` and re-renders. |

## Components on the server

`@temples/ssr` can render component tags to their markup for static output. See
[SSR and static site generation](ssr.html).

## Recipes and good practices

- [How to send messages](recipes/messages.html) — send an intent up to the owner and a change
  out to the app.
