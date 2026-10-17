---
title: API reference
description: Every public class, method, and type of the @temples packages.
order: 6
---

# API reference

## `@temples/engine`

### `Renderer`

The standalone rendering engine. One instance renders one template.

```javascript
new Renderer(source: Element | string)
```

The source is a DOM element, an element id (`"#id"`), or an HTML string. An id string binds the
existing page element in place, so every render writes into the live DOM; an unknown id throws.
An HTML string is parsed once into a container. The caller owns the instance — there is no
registry and nothing to destroy; release the renderer by dropping the reference.

| Member | Returns | Description |
|--------|---------|-------------|
| `render(data)` | `Element` | Renders the paths present in `data` into the template. Absent paths keep their state. Returns the template root element for insertion, cloning, or serialization. |
| `update(path, value)` | `Element` | Sets one dotted path (e.g. `"user.status"`) and re-renders only the bindings bound to that exact path. |
| `toHtml()` | `string` | Serialized HTML of the rendered template. |
| `renderToString()` | `string` | Synonym of `toHtml()`. |

### Types

```typescript
interface TemplesData {
    [key: string]: TemplesDataValue;
}

type TemplesDataValue =
    | string
    | number
    | boolean
    | null
    | ((this: TemplesData) => RenderValue)
    | TemplesData
    | TemplesDataValue[];
```

Function values are called with their parent object as `this`; the return value is used as the
bound value. See [Data-binding syntax](binding-syntax.html) for the attribute reference.

## `@temples/components`

### `TemplesComponent`

Base class for declarative Web Components. Inherit from it instead of `HTMLElement`.

**Class**

```typescript
class TemplesComponent<T extends object = Record<string, unknown>> extends HTMLElement {
    readonly state: T;          // reactive proxy, initialized through super({ ... })
    constructor(state?: T);
}
```

`T` is the complete state shape: the observed attributes plus every internal value. The subclass
declares it on the `extends` clause, and every `state` access is typed. An `interface` or a
`type` alias both work as the shape.

**Define**

```typescript
TemplesComponent.define(tagName: string, componentClass: TemplesComponentClass, options: DefineOptions): void;
```

```typescript
interface DefineOptions {
    template: string;                              // required
    attributes?: Record<string, AttributeType>;    // observed attributes, name to coercion type
    events?: EventMap;                             // bindings, see the components guide
    css?: string;                                  // stylesheet text for the SSR output
    globalStore?: TemplesData;                     // seeds attributes the tag does not set
}
```

`define()` is the one way to register a component. The class carries its `state` and handler
methods. The options carry the `template`, the `attributes` map, the `events`, the `css`, and the
`globalStore`. The `attributes` map derives the class `observedAttributes` and `attributeTypes`
statics, which stay internal. `define()` parses the template once, registers the event types, and
calls `customElements.define()`.

A class that declares its own `observedAttributes` or `attributeTypes` statics, and also passes
`attributes`, makes `define()` throw.

**Instance members**

| Member | Description |
|--------|-------------|
| `state` | The reactive state object, typed by the `TemplesComponent<T>` parameter and initialized through `super({ ... })` in the subclass constructor: attributes coerced by the `attributes` types, plus any internal values. Any mutation re-renders. |
| `emit(channel, detail?)` | Publishes a message on `channel`. The author chooses the name, for example `"shopping-item:updated"`. The message bubbles to the nearest subscribed ancestor, then the outer ancestors, then the decoupled subscribers. |
| `on(events)` | Merges additional bindings at runtime, same map format as the `events` option. |

**Types**

```typescript
type AttributeType = "boolean" | "number" | "json" | "string";

type EventMap = Record<string, string>;

type EventHandler = (this: TemplesComponent<object>, event: Event) => void;

interface TemplesComponentClass {
    tag: string;
    template: string;
    css: string;
    events: EventMap;
    observedAttributes: string[];
    attributeTypes: Record<string, AttributeType>;
    globalStore?: TemplesData;
    new (...args: never[]): HTMLElement;
}
```

`TemplesComponentClass` is the boundary type for any subclass constructor, whatever state type
its instances carry. `define()` and the SSR `templesComponents` option accept it, so a
heterogeneous list of component classes needs no cast.

### `@temples/components/reactive`

The reactive primitive, exported separately for direct use:

| Member | Description |
|--------|-------------|
| `reactive(target)` | Wraps an object in a deep proxy. Mutations of any nested property or array element notify subscribers. |
| `subscribe(target, listener)` | Attaches a listener to a reactive proxy. Returns an unsubscribe function. |

## `@temples/ssr`

### `prepare(source, options?)`

Compiles an HTML source (fragment or full document, single root required) into an async render
function. `prepare` itself is synchronous; the render call is the async boundary:

```typescript
import type { RenderFunction } from "@temples/ssr";

const render: RenderFunction = prepare(source, {
    removeDataBindings: true, // default: unwrap rendered components to their children
    templesComponents: [], // TemplesComponent classes used by the source
    rehydrate: false // reserved
});
```

Every call parses fresh and renders independently. See
[SSR and static site generation](ssr.html) for behavior and examples.

## `@temples/jquery`

Importing the entry registers the plugin:

| Expression | Effect |
|------------|--------|
| `$(selector).temples(data)` | Renders `data` into every matched element. |
| `$(selector).temples()` | Returns the prepared `Renderer`. |

jQuery is a peer dependency (>= 3). Importing the plugin without jQuery throws a clear error.
