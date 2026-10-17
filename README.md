# @temples: Declarative HTML Templates

![@temples logo](assets/temples-logo.png)

`@temples` or `templ(at)es` are templates for HTML that you won't hate. Templates are plain
HTML blocks decorated with a few `data-bind` attributes — no non-HTML syntax, no framework. The
same templates render in the browser and on the server.

This repository is a Bun workspace monorepo. It is a rewriting of the original
[temples v0](https://github.com/zipang/temples/tree/v0) template system, with jQuery replaced by a
standard, DOM-based engine.

## Packages

| Package | Description |
|---------|-------------|
| [`@temples/engine`](packages/engine) | The standalone `Renderer`: `data-bind` / `data-iterate` / `data-render-if` / `data-show-if` / `data-hide-if`, partial real-time updates, serialization. |
| [`@temples/components`](packages/components) | The `TemplesComponent` base class for declarative Web Components with reactive state. |
| [`@temples/ssr`](packages/ssr) | Server-side rendering and static site generation, wired to linkedom. |
| [`@temples/jquery`](packages/jquery) | The `$.fn.temples(data)` jQuery plugin (jQuery is a peer dependency). |

## Library size

The packages ship plain ES modules. The minified builds have the following sizes:

| Package | Minified | Gzip |
|---------|----------|------|
| `@temples/engine` | 6.3 kB | 2.6 kB |
| `@temples/components` | 6.3 kB | 2.5 kB |
| `@temples/ssr` | 1.7 kB | 926 B |
| `@temples/jquery` | 430 B | 298 B |

Run `bun run build` and then `bun run build:report --summary` to regenerate this table.

## Documentation

The documentation site is built in [`packages/docs`](packages/docs) — with temples itself. It
deploys as a static site to <https://zipang.github.io/temples/>, and ships an `llms.txt` for AI
coding agents.

## Development

```sh
bun install            # install all workspaces
bun test               # run every package's tests
bun run check          # Biome format + lint
bun run typecheck      # tsc --noEmit
bun run build          # build all packages (engine first)
bun run build:report   # print the size of every built asset (raw and gzip)
bun run demo           # serve the example app
bun run build:docs     # build the documentation site
```

## Repository layout

```
packages/
  engine/       @temples/engine
  components/   @temples/components
  ssr/          @temples/ssr
  jquery/       @temples/jquery
  docs/         documentation site (private, built with temples)
example/        shopping-list demo app
roadmap/        spec, plan, and task list
```

## License

MIT

## Glossary

- **DOM event**: A native browser event, such as a click or a submit. A component binds it with
  `"<eventType> <selector>"`. It carries a UI interaction, and it bubbles up the component tree.
- **Message**: A value that `emit()` publishes on the message bus. It carries a domain meaning,
  such as `shopping-item:removed`. The author chooses the channel name.
- **Message bus**: The shared channel that routes messages between components that do not know
  each other. A message bubbles to the ancestor components first, then reaches the bus.
