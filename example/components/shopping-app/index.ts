import { TemplesComponent } from "@temples/components";
import { isShoppingItemData, type ShoppingItemData } from "../../types.ts";
import template from "./shopping-app.html" with { type: "text" };
import "./shopping-app.css";

/**
 * The complete state shape of the app: the `title` attribute, the shared list,
 * and the `isEmpty` helper the template calls.
 */
type ShoppingAppState = {
	title: string;
	items: ShoppingItemData[];
	isEmpty(): boolean;
};

/**
 * The root of the shopping list, owning the shared list of items.
 *
 * The app seeds its `title` from the global store, renders one `shopping-item`
 * per entry, and updates the list from the change messages of the children:
 * `shopping-item:updated`, `shopping-item:removed`, and
 * `shopping-vault:recalled`. A new item is added locally, so the add needs no
 * message.
 *
 * The app handles `shopping-item:removed` without stopping the walk, so the
 * vault also receives the change and collects the removed item.
 */
export class ShoppingApp extends TemplesComponent<ShoppingAppState> {
	constructor() {
		super({
			title: "",
			items: [],
			isEmpty() {
				return this.items.length === 0;
			}
		});
	}

	/**
	 * Create a new item from the add form and add it to the list.
	 */
	addItem(evt: Event): void {
		evt.preventDefault();

		const form = evt.target as HTMLFormElement;
		const input = form.querySelector<HTMLInputElement>("input.add-input");
		const label = input?.value.trim() ?? "";

		if (!input || !label) return;

		this.state.items.push({ id: crypto.randomUUID(), label, checked: false });

		// RAZ and refocus
		input.value = "";
		input.focus();
	}

	/**
	 * Apply an updated item to the matching entry.
	 */
	onShoppingItemUpdated(evt: CustomEvent): void {
		if (!isShoppingItemData(evt.detail)) return;

		const item = evt.detail;
		const existing = this.state.items.find((entry) => entry.id === item.id);

		if (existing === undefined) return;

		existing.label = item.label;
		existing.checked = item.checked;
	}

	/**
	 * Drop the removed item from the active list.
	 *
	 * The walk is not stopped, so the vault also receives the change.
	 */
	onShoppingItemRemoved(evt: CustomEvent): void {
		if (!isShoppingItemData(evt.detail)) return;

		this.state.items = this.state.items.filter((entry) => entry.id !== evt.detail.id);
	}

	/**
	 * Restore a recalled item back into the active list.
	 */
	onShoppingVaultRecalled(evt: CustomEvent): void {
		if (!isShoppingItemData(evt.detail)) return;

		this.state.items.push(evt.detail);
	}
}

TemplesComponent.define("shopping-app", ShoppingApp, {
	template,
	attributes: { title: "string" },
	events: {
		"submit .add-form": "addItem",
		"shopping-item:updated": "onShoppingItemUpdated",
		"shopping-item:removed": "onShoppingItemRemoved",
		"shopping-vault:recalled": "onShoppingVaultRecalled"
	},
	globalStore: { title: "My Shopping List" }
});
