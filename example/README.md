# Shopping list example

This directory contains a working example of a temples application. It composes several
components and shows every data attribute (`data-bind`, `data-iterate`, `data-render-if`), plus the
event model.

Run the interactive example with `bun demo` from the project root, or with `bun --hot index.html`
from this directory.

## Components

| Component | Role |
|-----------|------|
| `shopping-app` | Owns the list. Renders one `shopping-item` per entry and one `shopping-vault`. |
| `shopping-item` | One list entry. Publishes `shopping-item:updated` and `shopping-item:removed`. |
| `shopping-vault` | Collects the removed items and restores them on recall. |
| `icon-button` | A reusable icon button. Publishes the intent named by its `action` attribute. |

## How the components talk

The components exchange messages on the `shopping-item` and `shopping-vault` channels. A reusable
button publishes the intent, and the owner publishes the change.

| Message | From | To |
|---------|------|----|
| `shopping-item:save` | the item's save button | the item |
| `shopping-item:remove` | the item's remove button | the item |
| `shopping-item:updated` | the item | the app |
| `shopping-item:removed` | the item | the app and the vault |
| `shopping-vault:recall` | the vault's recall button | the vault |
| `shopping-vault:recalled` | the vault | the app |

An intent bubbles to its owner and stops there. A change bubbles to the app. The message bus then
carries `shopping-item:removed` to the vault. See the components guide for the full rules.

## Local package imports

The example imports each package by name, for example
`import { TemplesComponent } from "@temples/components"`. The root `tsconfig.json` maps each
`@temples/*` subpath to its package source, so the editor, `tsc`, and the Bun dev flow resolve the
same files. No build is necessary before the demo.
